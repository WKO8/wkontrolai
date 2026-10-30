'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Smartphone,
  Check,
  Copy,
  ExternalLink,
  Sparkles,
  AlertCircle,
  QrCode,
  ShieldCheck,
  User,
  MessageSquare,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  formatPhoneDisplay,
  getBotWhatsAppUrl,
  getBotWhatsAppNumber,
} from '@/lib/utils';

export interface PairingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPhone?: string | null;
  onPairSuccess?: (phone: string) => void;
}

/**
 * Aplica máscara de telefone celular brasileiro: (DD) 9XXXX-XXXX
 */
function applyPhoneMask(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

export function PairingModal({
  isOpen,
  onClose,
  currentPhone,
  onPairSuccess,
}: PairingModalProps) {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showChangePhone, setShowChangePhone] = useState(false);

  // Estado do código OTP gerado
  const [otpResult, setOtpResult] = useState<{
    otpCode: string;
    deepLink: string;
    expiresInSeconds: number;
    normalizedPhone: string;
  } | null>(null);

  const [copied, setCopied] = useState(false);

  const botNumber = getBotWhatsAppNumber();
  const formattedBotPhone = formatPhoneDisplay(botNumber);

  useEffect(() => {
    if (isOpen) {
      if (currentPhone) {
        setPhone(applyPhoneMask(currentPhone.replace(/\D/g, '')));
        setShowChangePhone(false);
      } else {
        setPhone('');
        setShowChangePhone(true);
      }
      setErrorMessage(null);
      setOtpResult(null);
      setCopied(false);
    }
  }, [isOpen, currentPhone]);

  if (!isOpen) return null;

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(applyPhoneMask(e.target.value));
    if (errorMessage) setErrorMessage(null);
  };

  const handleGeneratePairing = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 11) {
      setErrorMessage('Informe um celular brasileiro com DDD válido (ex: 11 98765-4321)');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: digits,
          name: name.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorDetail =
          data.details?.fieldErrors?.phone?.[0] ||
          data.error ||
          'Erro ao processar solicitação de pareamento';
        setErrorMessage(errorDetail);
        setIsLoading(false);
        return;
      }

      const officialDeepLink =
        data.deepLink || getBotWhatsAppUrl(`VINCULAR ${data.otpCode}`);

      setOtpResult({
        otpCode: data.otpCode,
        deepLink: officialDeepLink,
        expiresInSeconds: data.expiresInSeconds || 600,
        normalizedPhone: data.user.whatsappPhone,
      });

      // Salva o telefone no localStorage
      try {
        localStorage.setItem('wkontrol_paired_phone', data.user.whatsappPhone);
      } catch {
        // Ignora erros de quota/localstorage
      }
    } catch (err) {
      console.error('Erro de requisição /api/auth/pair:', err);
      setErrorMessage('Falha ao conectar ao servidor. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCode = async () => {
    if (!otpResult) return;
    const commandText = `VINCULAR ${otpResult.otpCode}`;
    try {
      await navigator.clipboard.writeText(commandText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback manual de seleção caso a clipboard API não esteja disponível
    }
  };

  const handleFinish = () => {
    if (otpResult) {
      onPairSuccess?.(otpResult.normalizedPhone);
    }
    onClose();
  };

  const handleUnpair = () => {
    try {
      localStorage.removeItem('wkontrol_paired_phone');
    } catch {
      // noop
    }
    onPairSuccess?.('');
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pairing-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
    >
      <div className="w-full max-w-md rounded-3xl bg-card border border-border shadow-2xl overflow-hidden transition-all flex flex-col">
        {/* Header com gradiente sutil */}
        <div className="relative p-5 sm:p-6 pb-4 border-b border-border/60 bg-gradient-to-br from-emerald-500/10 via-card to-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3
                  id="pairing-modal-title"
                  className="text-base sm:text-lg font-bold tracking-tight text-foreground"
                >
                  {currentPhone && !otpResult
                    ? 'WhatsApp Conectado'
                    : 'Vincular WhatsApp'}
                </h3>
                <span className="text-xs text-muted-foreground">
                  {otpResult
                    ? 'Confirme o pareamento pelo seu WhatsApp'
                    : 'Conecte seu número para registrar despesas por áudio e texto'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar janela de pareamento"
              className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors focus-ring"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Corpo do Modal */}
        <div className="p-5 sm:p-6 space-y-4">
          {!otpResult ? (
            <div className="space-y-4">
              {/* Usuário já vinculado anteriormente */}
              {currentPhone && !showChangePhone && (
                <div className="space-y-4 animate-fade-in">
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                        </span>
                        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 font-mono">
                          Dispositivo ativo: {formatPhoneDisplay(currentPhone)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleUnpair}
                        className="text-xs font-medium text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                      >
                        Desvincular
                      </button>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Sua conta está conectada ao assistente oficial do WKontrolAI (
                      <span className="font-semibold text-foreground font-mono">{formattedBotPhone}</span>).
                      Envie áudios ou mensagens de texto a qualquer momento para registrar seus gastos!
                    </p>

                    {/* Botão de Abrir Chat com o BOT Oficial */}
                    <a
                      href={getBotWhatsAppUrl('Olá! Gostaria de registrar uma movimentação')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full"
                    >
                      <Button
                        type="button"
                        variant="whatsapp"
                        size="lg"
                        className="w-full gap-2 shadow-md h-11 text-sm font-semibold"
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>Conversar com WKontrolAI no WhatsApp</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    </a>
                  </div>

                  <div className="pt-1 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => setShowChangePhone(true)}
                      className="text-primary hover:underline font-medium flex items-center gap-1"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Vincular outro número</span>
                    </button>

                    <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">
                      Fechar
                    </Button>
                  </div>
                </div>
              )}

              {/* Formulário de Pareamento (Novo vínculo ou troca de número) */}
              {(!currentPhone || showChangePhone) && (
                <form onSubmit={handleGeneratePairing} className="space-y-4 animate-fade-in">
                  {showChangePhone && currentPhone && (
                    <div className="flex items-center justify-between text-xs pb-1">
                      <span className="text-muted-foreground">Número atual: {formatPhoneDisplay(currentPhone)}</span>
                      <button
                        type="button"
                        onClick={() => setShowChangePhone(false)}
                        className="text-primary hover:underline"
                      >
                        Cancelar troca
                      </button>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                      Número de Celular (WhatsApp)
                    </label>
                    <Input
                      type="tel"
                      placeholder="(11) 98765-4321"
                      value={phone}
                      onChange={handlePhoneChange}
                      icon={<Smartphone className="w-4 h-4 text-emerald-500" />}
                      className="h-11 text-base tracking-wide font-medium"
                      required
                    />
                    <span className="text-[11px] text-muted-foreground mt-1 block">
                      Informe o DDD e os 9 dígitos do seu WhatsApp móvel.
                    </span>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                      Seu Nome ou Apelido (Opcional)
                    </label>
                    <Input
                      type="text"
                      placeholder="Ex: Carlos Oliveira"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      icon={<User className="w-4 h-4 text-muted-foreground" />}
                      className="h-11 text-sm"
                    />
                  </div>

                  {errorMessage && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  <div className="pt-2">
                    <Button
                      type="submit"
                      size="lg"
                      isLoading={isLoading}
                      className="w-full gap-2 shadow-lg shadow-primary/25 h-11"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Gerar Código de Vinculação</span>
                    </Button>
                  </div>

                  <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground pt-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Vinculação criptografada com código OTP único de 10 min</span>
                  </div>
                </form>
              )}
            </div>
          ) : (
            /* Passo 2: Exibição do Código OTP & Botão WhatsApp apontando para o bot oficial */
            <div className="space-y-4 text-center animate-fade-in">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 mx-auto flex items-center justify-center">
                <QrCode className="w-6 h-6 animate-pulse" />
              </div>

              <div className="space-y-1">
                <h4 className="text-sm font-bold text-foreground">
                  Código de Ativação Gerado!
                </h4>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  Envie a mensagem abaixo para nosso WhatsApp oficial ({formattedBotPhone}) para autorizar sua conta:
                </p>
              </div>

              {/* Destaque Legível do Comando OTP */}
              <div className="p-4 rounded-2xl bg-secondary/80 border border-emerald-500/30 flex flex-col items-center gap-2 relative">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                  Comando de Ativação
                </span>
                <div className="text-xl sm:text-2xl font-black font-mono tracking-wider text-emerald-600 dark:text-emerald-400 bg-card px-4 py-2 rounded-xl border border-border shadow-inner">
                  VINCULAR {otpResult.otpCode}
                </div>

                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-600 dark:hover:text-primary-400 transition-colors focus-ring rounded-lg px-2 py-1"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-500">Copiado para a área de transferência!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar Código</span>
                    </>
                  )}
                </button>
              </div>

              {/* Botão de Ação Direta WhatsApp (1 Clique para o BOT oficial) */}
              <div className="space-y-2 pt-2">
                <a
                  href={otpResult.deepLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full block"
                >
                  <Button
                    type="button"
                    variant="whatsapp"
                    size="lg"
                    className="w-full gap-2 shadow-lg h-11 text-sm font-semibold"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Abrir WhatsApp e Enviar</span>
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </a>

                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={handleFinish}
                  className="w-full h-10 text-xs"
                >
                  Concluir / Já Enviei
                </Button>
              </div>

              <div className="text-[11px] text-muted-foreground">
                Código expira em{' '}
                <span className="font-semibold text-foreground">
                  {Math.round(otpResult.expiresInSeconds / 60)} minutos
                </span>
                .
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
