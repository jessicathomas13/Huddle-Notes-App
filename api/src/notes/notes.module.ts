import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NotesService } from './notes.service';
import { NotesController } from './notes.controller';
import { NotesGateway } from './notes.gateway';

@Module({
  imports: [JwtModule], 
  providers: [NotesService, NotesGateway],
  controllers: [NotesController]
})
export class NotesModule {}
