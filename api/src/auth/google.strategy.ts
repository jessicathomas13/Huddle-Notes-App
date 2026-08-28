import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private configService: ConfigService) {
    super({
        clientID: configService.get<string>('GOOGLE_CLIENT_ID')!,
        clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET')!,
        callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL')!,
        scope: ['email', 'profile'],
        passReqToCallback: false,
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { id, name, emails, photos } = profile;
    const fullName = [name?.givenName, name?.familyName].filter(Boolean).join(' ') || profile.displayName || 'Unknown';
    const user = {
      googleId: id,
      email: emails[0].value,
      name: fullName,
      avatarUrl: photos[0]?.value,
    };
    done(null, user);
  }
}