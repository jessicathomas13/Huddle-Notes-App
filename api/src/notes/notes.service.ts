import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class NotesService {
  // Create a note owned by the logged-in user
  async create(userId: string, title: string, content: string) {
    return prisma.note.create({
      data: { title, content, ownerId: userId },
    });
  }

  // Get every note the user owns or has been added to as a collaborator
  async findAllForUser(userId: string) {
    return prisma.note.findMany({
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
    const note = await prisma.note.findUnique({ where: { id: noteId } });
    if (!note) throw new NotFoundException('Note not found');
    await this.assertAccess(userId, note); // throws if not owner/collaborator
    return note;
  }

  // Edit a note, same access check as findOne
  async update(userId: string, noteId: string, data: { title?: string; content?: string }) {
    const note = await prisma.note.findUnique({ where: { id: noteId } });
    if (!note) throw new NotFoundException('Note not found');
    await this.assertAccess(userId, note);
    return prisma.note.update({ where: { id: noteId }, data });
  }

  // Delete a note - owner only, collaborators can't delete
  async remove(userId: string, noteId: string) {
    const note = await prisma.note.findUnique({ where: { id: noteId } });
    if (!note) throw new NotFoundException('Note not found');
    if (note.ownerId !== userId) {
      throw new ForbiddenException('Only the owner can delete this note');
    }
    return prisma.note.delete({ where: { id: noteId } });
  }

  // Shared access check used by findOne/update.
  // Passes silently if allowed; throws 403 if not.
  private async assertAccess(userId: string, note: { id: string; ownerId: string }) {
    if (note.ownerId === userId) return; // owner always has access

    // otherwise check the join table for a collaborator record
    const collab = await prisma.noteCollaborator.findUnique({
      where: { noteId_userId: { noteId: note.id, userId } },
    });
    if (!collab) throw new ForbiddenException('You do not have access to this note');
  }
}