import {
  Controller, Get, Post, Patch, Delete, Body, Param, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotesService } from './notes.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { AddCollaboratorDto } from './dto/add-collaborator.dto';

@Controller('notes')
@UseGuards(JwtAuthGuard) // user must be logged in
export class NotesController {
  constructor(private notesService: NotesService) {}

  // POST /notes - create a note for the logged-in user
  @Post()
  create(@Req() req, @Body() dto: CreateNoteDto) {
    // req.user comes from JwtStrategy.validate() — set once the token is verified
    return this.notesService.create(req.user.userId, dto.title, dto.content ?? '');
  }

  // GET /notes - list notes the user owns or collaborates on
  @Get()
  findAll(@Req() req) {
    return this.notesService.findAllForUser(req.user.userId);
  }

  // POST /notes/:id/collaborators - owner adds a collaborator to a note by email
  @Post(':id/collaborators')
  addCollaborator(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: AddCollaboratorDto,
  ) {
    return this.notesService.addCollaborator(
      req.user.userId,
      id,
      dto.email,
    );
  }

  // GET /notes/:id - fetch one note (access-checked in the service)
  @Get(':id')
  findOne(@Req() req, @Param('id') id: string) {
    return this.notesService.findOne(req.user.userId, id);
  }

  // PATCH /notes/:id - partial update (title and/or content)
  @Patch(':id')
  update(@Req() req, @Param('id') id: string, @Body() dto: UpdateNoteDto) {
    return this.notesService.update(req.user.userId, id, dto);
  }

  // DELETE /notes/:id - owner only (enforced in the service)
  @Delete(':id')
  remove(@Req() req, @Param('id') id: string) {
    return this.notesService.remove(req.user.userId, id);
  }

  // POST /notes/:id/summarize - generate an AI summary + tags via Gemini, save and return the updated note
  @Post(':id/summarize')
  summarize(@Req() req, @Param('id') id: string){
    return this.notesService.summarize(req.user.userId, id);
  }

}