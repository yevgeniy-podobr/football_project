import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
  hashSync: jest.fn(),
  compareSync: jest.fn(),
}));

const mockUser = {
  id: 1,
  email: 'john@example.com',
  username: 'johndoe',
  passwordHash: 'stored-hash',
  role: 'USER' as const,
  firstName: null,
  lastName: null,
};

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<
    Pick<UsersService, 'findByEmail' | 'findByUsername' | 'createWithPassword'>
  >;

  beforeEach(async () => {
    usersService = {
      findByEmail: jest.fn(),
      findByUsername: jest.fn(),
      createWithPassword: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: { sign: jest.fn().mockReturnValue('test-token') } },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => ({ BREVO_API_KEY: 'brevo-test-key' })[key] ?? ''),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('login', () => {
    it('throws UnauthorizedException when the user does not exist', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      await expect(service.login('nobody@example.com', 'pass')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when the password is wrong', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as never);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(service.login('john@example.com', 'wrongpass')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('returns a token when credentials are correct', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as never);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      const result = await service.login('john@example.com', 'correctpass');
      expect(result).toMatchObject({ access_token: 'test-token' });
    });
  });

  describe('register', () => {
    it('hashes the password with 10 rounds before persisting', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.findByUsername.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-pw');
      usersService.createWithPassword.mockResolvedValue(mockUser as never);

      await service.register('johndoe', 'john@example.com', 'plaintext');

      expect(bcrypt.hash).toHaveBeenCalledWith('plaintext', 10);
      expect(usersService.createWithPassword).toHaveBeenCalledWith(
        'johndoe',
        'john@example.com',
        'hashed-pw',
        undefined,
        undefined,
      );
    });

    it('throws ConflictException when email is already in use', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as never);
      await expect(service.register('johndoe', 'john@example.com', 'pass')).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
