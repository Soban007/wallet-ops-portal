import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { User } from './user.entity';
import { CreateUserInput } from './users.types';

// Postgres error code for a unique-constraint violation.
const UNIQUE_VIOLATION = '23505';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async create(input: CreateUserInput): Promise<User> {
    const existing = await this.users.findOne({ where: { email: input.email } });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    try {
      const user = this.users.create(input);
      return await this.users.save(user);
    } catch (err) {
      // Backstop for the rare race where two requests insert the same email at
      // the same time: the unique constraint rejects the second one.
      if (err instanceof QueryFailedError && (err as { code?: string }).code === UNIQUE_VIOLATION) {
        throw new ConflictException('A user with this email already exists');
      }
      throw err;
    }
  }

  findAll(): Promise<User[]> {
    return this.users.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}
