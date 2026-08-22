import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// Wraps PrismaClient as an injectable Nest service
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  // Connect explicitly when the module initializes
  async onModuleInit() {
    await this.$connect();
  }

  // Cleanly close the connection when the app shuts down
  async onModuleDestroy() {
    await this.$disconnect();
  }
}