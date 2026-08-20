import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { NotesService } from './notes.service';
import { NotesController } from './notes.controller';
import { NotesGateway } from './notes.gateway';

@Module({
  imports: [AuthModule], 
  providers: [NotesService, NotesGateway],
  controllers: [NotesController]
})
export class NotesModule {}
