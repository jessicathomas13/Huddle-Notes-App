import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

// Shape of the request body for POST /notes.
export class CreateNoteDto {
  @IsString()
  @IsNotEmpty() // title is required, can't be empty string
  title!: string;

  @IsString()
  @IsOptional() 
  content?: string;
}