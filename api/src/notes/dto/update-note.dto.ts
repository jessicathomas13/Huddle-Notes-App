import { IsString, IsOptional } from 'class-validator';

// Shape of the request body for PATCH /notes/:id.
// Both fields optional since it's a partial update (only send what's changing).
export class UpdateNoteDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  content?: string;
}