import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';

// Typed from the adapter itself: it bundles its own copy of socket.io.
type ServerOptions = NonNullable<Parameters<IoAdapter['createIOServer']>[1]>;

// Browsers apply CORS to Socket.IO's handshake too. The gateway decorator can't
// read validated config, so the allowed origin is set here instead.
export class SocketIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly origin: string,
  ) {
    super(app);
  }

  override createIOServer(port: number, options?: ServerOptions): ReturnType<IoAdapter['createIOServer']> {
    return super.createIOServer(port, { ...options, cors: { origin: this.origin } } as ServerOptions);
  }
}
