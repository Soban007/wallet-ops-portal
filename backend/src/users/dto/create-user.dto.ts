import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'Soban Taimoor' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 120)
  name: string;

  @ApiProperty({ example: '+923001234567' })
  @IsString()
  @Matches(/^\+?[0-9]{7,15}$/, { message: 'phone must be a valid phone number' })
  phone: string;

  @ApiProperty({ example: 'soban@example.com' })
  @IsEmail()
  email: string;
}
