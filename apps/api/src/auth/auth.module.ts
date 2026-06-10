import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ClientsModule } from '../clients/clients.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    ClientsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        // тип ms.StringValue ('7d' и т.п.) — значение валидируется на старте Joi
        signOptions: { expiresIn: (config.get<string>('jwt.expiresIn') ?? '7d') as `${number}d` },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    // Глобальные guard'ы: сначала аутентификация, затем авторизация по ролям.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AuthModule {}
