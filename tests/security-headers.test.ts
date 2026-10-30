import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Security Headers & Edge Protection Suite (Caddy & Next.js)', () => {
  const rootDir = path.resolve(__dirname, '..');
  const caddyfilePath = path.join(rootDir, 'Caddyfile');
  const nextConfigPath = path.join(rootDir, 'next.config.mjs');

  const caddyContent = fs.readFileSync(caddyfilePath, 'utf-8');
  const nextConfigContent = fs.readFileSync(nextConfigPath, 'utf-8');

  describe('1. Caddyfile OWASP & Mozilla Observatory A+ Grade Headers', () => {
    it('deve conter HSTS (Strict-Transport-Security) com 1 ano, subdomínios e preload', () => {
      expect(caddyContent).toContain(
        'Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"'
      );
    });

    it('deve conter X-Content-Type-Options nosniff', () => {
      expect(caddyContent).toContain('X-Content-Type-Options "nosniff"');
    });

    it('deve conter X-Frame-Options DENY para proteção anti-clickjacking', () => {
      expect(caddyContent).toContain('X-Frame-Options "DENY"');
    });

    it('deve conter Referrer-Policy strict-origin-when-cross-origin', () => {
      expect(caddyContent).toContain('Referrer-Policy "strict-origin-when-cross-origin"');
    });

    it('deve desativar permissões sensíveis via Permissions-Policy', () => {
      expect(caddyContent).toContain(
        'Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()"'
      );
    });

    it('deve bloquear políticas cross-domain via X-Permitted-Cross-Domain-Policies none', () => {
      expect(caddyContent).toContain('X-Permitted-Cross-Domain-Policies "none"');
    });

    it('deve conter isolamento Cross-Origin-Opener-Policy same-origin', () => {
      expect(caddyContent).toContain('Cross-Origin-Opener-Policy "same-origin"');
    });

    it('deve conter proteção Cross-Origin-Resource-Policy same-origin', () => {
      expect(caddyContent).toContain('Cross-Origin-Resource-Policy "same-origin"');
    });

    it('deve conter Content-Security-Policy (CSP) robusta e compatível com Next.js 15 e PWA', () => {
      expect(caddyContent).toContain('Content-Security-Policy');
      expect(caddyContent).toContain("default-src 'self'");
      expect(caddyContent).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
      expect(caddyContent).toContain("style-src 'self' 'unsafe-inline'");
      expect(caddyContent).toContain("img-src 'self' data: https: blob:");
      expect(caddyContent).toContain("connect-src 'self' https: wss: ws:");
      expect(caddyContent).toContain("media-src 'self' data: blob:");
      expect(caddyContent).toContain("frame-ancestors 'none'");
      expect(caddyContent).toContain("manifest-src 'self'");
      expect(caddyContent).toContain("worker-src 'self' blob:");
    });

    it('deve remover cabeçalhos de identificação do servidor (-Server e -X-Powered-By)', () => {
      expect(caddyContent).toContain('-Server');
      expect(caddyContent).toContain('-X-Powered-By');
    });

    it('deve utilizar a diretiva defer para garantir injeção em respostas do reverse_proxy', () => {
      expect(caddyContent).toContain('defer');
    });
  });

  describe('2. Bloqueio de Arquivos Sensíveis na Borda (Caddy Edge Block)', () => {
    it('deve bloquear *.map, *.env*, *.git*, *docker-compose* e *Dockerfile*', () => {
      expect(caddyContent).toContain('*.map');
      expect(caddyContent).toContain('*.env*');
      expect(caddyContent).toContain('*.git*');
      expect(caddyContent).toContain('*docker-compose*');
      expect(caddyContent).toContain('*Dockerfile*');
    });

    it('deve retornar status 404 para arquivos sensíveis', () => {
      expect(caddyContent).toContain('respond @blocked "Not Found" 404');
    });
  });

  describe('3. Next.js 15 Hardening (next.config.mjs)', () => {
    it('deve desabilitar poweredByHeader no Next.js', () => {
      expect(nextConfigContent).toContain('poweredByHeader: false');
    });

    it('deve desabilitar productionBrowserSourceMaps para não expor código em produção', () => {
      expect(nextConfigContent).toContain('productionBrowserSourceMaps: false');
    });
  });
});
