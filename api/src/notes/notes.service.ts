import { BadRequestException, ConflictException, Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ConfigService } from '@nestjs/config';


@Injectable()
export class NotesService {
  private genAI: GoogleGenerativeAI;

  constructor(private configService: ConfigService, private prisma: PrismaService){
    this.genAI = new GoogleGenerativeAI(this.configService.get<string>('GEMINI_API_KEY')!);
  }
  
  // Create a note owned by the logged-in user
  async create(userId: string, title: string, content: string) {
    return this.prisma.note.create({
      data: { title, content, ownerId: userId },
    });
  }

  // Get every note the user owns or has been added to as a collaborator
  async findAllForUser(userId: string) {
    return this.prisma.note.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { collaborators: { some: { userId } } },
        ],
      },
      orderBy: { updatedAt: 'desc' }, // most recently edited first
    });
  }

  // Get a single note, but only if the user is allowed to see it
  async findOne(userId: string, noteId: string) {
    const note = await this.prisma.note.findUnique({ where: { id: noteId } });
    if (!note) throw new NotFoundException('Note not found');
    await this.assertAccess(userId, note); // throws if not owner/collaborator
    return note;
  }

  // Edit a note, same access check as findOne
  async update(userId: string, noteId: string, data: { title?: string; content?: string }) {
    const note = await this.prisma.note.findUnique({ where: { id: noteId } });
    if (!note) throw new NotFoundException('Note not found');
    await this.assertAccess(userId, note);
    return this.prisma.note.update({ where: { id: noteId }, data });
  }

  // Delete a note - owner only, collaborators can't delete
  async remove(userId: string, noteId: string) {
    const note = await this.prisma.note.findUnique({ where: { id: noteId } });
    if (!note) throw new NotFoundException('Note not found');
    if (note.ownerId !== userId) {
      throw new ForbiddenException('Only the owner can delete this note');
    }
    return this.prisma.note.delete({ where: { id: noteId } });
  }

  // Shared access check used by findOne/update.
  // Passes silently if allowed; throws 403 if not.
  private async assertAccess(userId: string, note: { id: string; ownerId: string }) {
    if (note.ownerId === userId) return; // owner always has access

    // otherwise check the join table for a collaborator record
    const collab = await this.prisma.noteCollaborator.findUnique({
      where: { noteId_userId: { noteId: note.id, userId } },
    });
    if (!collab) throw new ForbiddenException('You do not have access to this note');
  }

  // Generates a summary + tags for a note using Gemini, and saves them
  async summarize(userId: string, noteId: string) {
    const note = await this.prisma.note.findUnique({ where: { id: noteId } });
    if (!note) throw new NotFoundException('Note not found');
    await this.assertAccess(userId, note);

    const prompt = `Summarize the following note in one short sentence, and suggest 2-4 relevant single-word or short-phrase tags.
  Respond ONLY with valid JSON in this exact shape, no other text: {"summary": "...", "tags": ["...", "..."]}

  Note content:
  ${note.content}`;

    const text = await this.generateWithRetry(prompt);

    const cleaned = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return this.prisma.note.update({
      where: { id: noteId },
      data: { summary: parsed.summary, tags: parsed.tags },
    });
  }

  // Tries gemini-flash-latest with a couple of retries (backing off each time),
  // then falls back to gemini-2.5-flash-lite if it's still overloaded.
  private async generateWithRetry(prompt: string): Promise<string> {
    const primaryModel = this.genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
    const fallbackModel = this.genAI.getGenerativeModel({ model: 'gemini-3.5-flash-lite' });

    const delays = [1000, 3000]; // wait 1s, then 3s, between retries

    for (let attempt = 0; attempt <= delays.length; attempt++) {
      try {
        const result = await primaryModel.generateContent(prompt);
        return result.response.text();
      } catch (err: any) {
        const isOverloaded = err?.status === 503;
        const isLastAttempt = attempt === delays.length;

        if (!isOverloaded || isLastAttempt) {
          // not a 503, or we're out of retries on the primary model - try the fallback once
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
      }
    }

    // Primary model exhausted its retries - try a different, often less-contended model
    const fallbackResult = await fallbackModel.generateContent(prompt);
    return fallbackResult.response.text();
  }

  // Add a collaborator by email (only users that exist in the database for now)
  // Can add invite by email later
  async addCollaborator( ownerId: string, noteId: string, email: string ) {
    const note = await this.prisma.note.findUnique({
      where: { id: noteId },
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    // Only the note owner can share it
    if (note.ownerId !== ownerId) {
      throw new ForbiddenException( 'Only the owner can add collaborators');
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException( 'No Huddle user exists with that email');
    }

    // Owner cannot add themselves as a collaborator
    if (user.id === ownerId) {
      throw new BadRequestException('You cannot add yourself as a collaborator');
    }

    const existingCollaborator =
      await this.prisma.noteCollaborator.findUnique({
        where: {
          noteId_userId: {
            noteId,
            userId: user.id,
          },
        },
      });

    if (existingCollaborator) {
      throw new ConflictException( 'User is already a collaborator');
    }

    return this.prisma.noteCollaborator.create({
      data: {
        noteId,
        userId: user.id,
        role: 'editor',
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  // Get everyone with access to a note: the owner + all collaborators
  async getCollaborators(userId: string, noteId: string) {
    const note = await this.prisma.note.findUnique({
      where: { id: noteId },
      include: {
        owner: {
          select: { id: true, email: true, name: true, avatarUrl: true },
        },
        collaborators: {
          include: {
            user: {
              select: { id: true, email: true, name: true, avatarUrl: true },
            },
          },
        },
      },
    });

    if (!note) throw new NotFoundException('Note not found');
    await this.assertAccess(userId, note); // anyone with access can see who else has access

    return {
      owner: note.owner,
      collaborators: note.collaborators.map((c) => c.user),
    };
  }
}