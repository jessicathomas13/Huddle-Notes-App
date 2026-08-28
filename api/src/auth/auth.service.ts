import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService, private prisma: PrismaService) {}

  async validateOAuthUser(googleUser: any): Promise<string> {
    let user = await this.prisma.user.findUnique({
      where: { googleId: googleUser.googleId },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          googleId: googleUser.googleId,
          email: googleUser.email,
          name: googleUser.name,
          avatarUrl: googleUser.avatarUrl,
        },
      });
    } else {
      // keep existing users' name/avatar in sync with Google, and self-heals any bad data from before this fix
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { name: googleUser.name, avatarUrl: googleUser.avatarUrl },
      });
    }

    return this.jwtService.sign({ sub: user.id, email: user.email });
  }
}