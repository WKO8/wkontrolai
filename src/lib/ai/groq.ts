/**
 * WKontrolAI — Groq Cloud Whisper API Client
 * Transcrição ultrarrápida de áudios de voz via modelo whisper-large-v3
 */

import type { AudioTranscriptionResult } from '@/types';

export class GroqAudioClient {
  private readonly apiKey: string;
  private readonly baseUrl: string = 'https://api.groq.com/openai/v1/audio/transcriptions';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GROQ_API_KEY || '';
  }

  /**
   * Transcreve um buffer de áudio (OGG Opus ou outros suportados)
   * utilizando a Groq Cloud LPU com modelo whisper-large-v3.
   */
  async transcribeAudio(
    audioBuffer: Buffer,
    mimetype: string = 'audio/ogg'
  ): Promise<AudioTranscriptionResult> {
    if (!this.apiKey) {
      throw new Error('GROQ_API_KEY é obrigatória para executar transcrição de áudio');
    }

    const startTime = performance.now();

    // Sanitiza o mimetype removendo codecs e parâmetros extras (ex: audio/ogg; codecs=opus -> audio/ogg)
    const cleanMimetype = (mimetype || 'audio/ogg').split(';')[0].trim().toLowerCase() || 'audio/ogg';

    let fileName = 'audio.ogg';
    if (cleanMimetype.includes('mp4') || cleanMimetype.includes('m4a')) {
      fileName = 'audio.m4a';
    } else if (cleanMimetype.includes('wav')) {
      fileName = 'audio.wav';
    } else if (cleanMimetype.includes('mp3') || cleanMimetype.includes('mpeg')) {
      fileName = 'audio.mp3';
    }

    const formData = new FormData();
    const audioBlob = new Blob([new Uint8Array(audioBuffer)], { type: cleanMimetype });
    formData.append('file', audioBlob, fileName);
    formData.append('model', 'whisper-large-v3');
    formData.append('language', 'pt');
    formData.append('temperature', '0.0');
    formData.append(
      'prompt',
      'reais, centavos, pix, cartão, débito, crédito, despesa, receita, transferência, boleto, mercado, almoço, gasolina, posto, farmácia, salário, freela'
    );
    formData.append('response_format', 'verbose_json');

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    const latencyMs = Math.round(performance.now() - startTime);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Falha na API Groq Whisper (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as {
      text?: string;
      duration?: number;
      language?: string;
    };

    const text = (data.text || '').trim();
    const durationSeconds = typeof data.duration === 'number' ? data.duration : 0;
    const language = data.language || 'pt';

    return {
      text,
      durationSeconds,
      latencyMs,
      language,
    };
  }
}

export const groq = new GroqAudioClient();
