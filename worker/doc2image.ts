import { Container } from '@cloudflare/containers';

export class Doc2ImageContainer extends Container {
  defaultPort = 8080;
  sleepAfter = '10m';
  envVars = {
    PORT: '8080',
  };

  override onStart() {
    console.log('Container successfully started');
  }

  override onStop() {
    console.log('Container successfully shut down');
  }

  override onError(error: unknown) {
    console.log('Container error:', error);
  }
}
