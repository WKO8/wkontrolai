'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  Bot,
  User,
  HelpCircle,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

export interface FinancialRagChatbotProps {
  pairedPhone?: string | null;
  selectedPeriod?: string;
}

const QUICK_QUESTION_CHIPS = [
  'Quanto gastei na padaria este mês?',
  'Qual minha maior despesa?',
  'Onde posso cortar gastos?',
  'Qual meu saldo e total de receitas?',
];

// Parser simples e seguro para renderizar Markdown do Bot (bold, code, listas com bullets e parágrafos)
function parseInlineMarkdown(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*([^*]+)\*\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    if (match[2]) {
      // **bold**
      parts.push(
        <strong key={match.index} className="font-bold text-foreground">
          {match[2]}
        </strong>
      );
    } else if (match[3]) {
      // `code`
      parts.push(
        <code key={match.index} className="px-1 py-0.5 rounded bg-muted/80 font-mono text-[11px] text-foreground">
          {match[3]}
        </code>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts;
}

function renderFormattedMessage(rawText: string) {
  const lines = rawText.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: React.ReactNode[] = [];

  const flushList = (keyPrefix: number) => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`ul-${keyPrefix}`} className="space-y-1.5 my-1.5 pl-0.5">
          {currentList}
        </ul>
      );
      currentList = [];
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList(idx);
      return;
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const content = trimmed.substring(2);
      currentList.push(
        <li key={`li-${idx}`} className="flex items-start gap-2 text-xs sm:text-sm">
          <span className="text-emerald-500 font-bold shrink-0 mt-0.5 select-none text-xs">•</span>
          <span className="flex-1 leading-relaxed text-foreground">{parseInlineMarkdown(content)}</span>
        </li>
      );
    } else {
      flushList(idx);
      elements.push(
        <p key={`p-${idx}`} className="text-xs sm:text-sm leading-relaxed text-foreground">
          {parseInlineMarkdown(trimmed)}
        </p>
      );
    }
  });

  flushList(lines.length);

  return <div className="space-y-2">{elements}</div>;
}

export function FinancialRagChatbot({
  pairedPhone,
  selectedPeriod,
}: FinancialRagChatbotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Olá! Sou o assistente financeiro inteligente do WKontrolAI. Posso responder qualquer dúvida sobre suas receitas, despesas e sugerir oportunidades de economia com base nos seus lançamentos.',
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query || isTyping) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          phone: pairedPhone || undefined,
          period: selectedPeriod || undefined,
        }),
      });

      const data = await response.json();

      const botReply: ChatMessage = {
        id: `reply-${Date.now()}`,
        sender: 'assistant',
        text: data.answer || 'Desculpe, não consegui processar a resposta no momento.',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botReply]);
    } catch (err) {
      console.error('Erro ao consultar /api/ai/chat:', err);
      const errorReply: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        text: 'Ocorreu um erro de conexão com o assistente de IA. Verifique sua conexão e tente novamente.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorReply]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: 'welcome-reset',
        sender: 'assistant',
        text: 'Histórico limpo. Como posso te ajudar com suas finanças agora?',
        timestamp: new Date(),
      },
    ]);
  };

  return (
    <Card className="border-border/80 overflow-hidden flex flex-col h-[520px]">
      {/* Header do Chat */}
      <CardHeader className="flex flex-row items-center justify-between py-3.5 px-4 sm:px-6 border-b border-border/50 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white flex items-center justify-center shadow-sm shadow-emerald-500/20">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-1.5">
              <span>Assistente Financeiro IA</span>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            </CardTitle>
            <span className="text-[11px] text-muted-foreground block">
              RAG conectado aos seus lançamentos reais
            </span>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearHistory}
          className="text-xs text-muted-foreground h-8 px-2 gap-1 cursor-pointer"
          title="Limpar histórico"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Limpar</span>
        </Button>
      </CardHeader>

      {/* Área de Mensagens com Scroll */}
      <CardContent className="flex-1 overflow-y-auto p-4 space-y-3.5 scroll-smooth">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              className={cn('flex items-start gap-2.5 max-w-[85%]', isUser ? 'ml-auto flex-row-reverse' : '')}
            >
              <div
                className={cn(
                  'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold mt-0.5 shadow-sm',
                  isUser
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                )}
              >
                {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
              </div>

              <div
                className={cn(
                  'p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-sm transition-all',
                  isUser
                    ? 'bg-emerald-600 text-white font-medium rounded-tr-none'
                    : 'bg-secondary/70 border border-border/70 text-foreground rounded-tl-none'
                )}
              >
                {isUser ? (
                  <span className="whitespace-pre-wrap">{msg.text}</span>
                ) : (
                  renderFormattedMessage(msg.text)
                )}
              </div>
            </div>
          );
        })}

        {/* Indicador de Digitação / Pensando */}
        {isTyping && (
          <div className="flex items-center gap-2.5 max-w-[85%] animate-fade-in">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="p-3 rounded-2xl rounded-tl-none bg-secondary/70 border border-border/70 text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:0.4s]" />
              <span className="ml-1 text-[11px]">Consultando seus lançamentos...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </CardContent>

      {/* Chips de Perguntas Rápidas */}
      <div className="relative p-2 sm:px-4 border-t border-border/40 bg-secondary/20 shrink-0">
        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 pt-0.5 px-1 pr-8 text-xs scroll-smooth no-scrollbar">
          <HelpCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0 ml-0.5" />
          {QUICK_QUESTION_CHIPS.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              disabled={isTyping}
              onClick={() => handleSendMessage(chip)}
              className="shrink-0 px-3 py-1.5 rounded-full bg-secondary/90 hover:bg-secondary border border-border/70 text-[11px] font-medium text-foreground transition-all hover:border-emerald-500/50 hover:shadow-sm focus-ring cursor-pointer whitespace-nowrap"
            >
              {chip}
            </button>
          ))}
        </div>
        {/* Gradiente de fade no canto direito indicando continuidade do scroll */}
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-card via-card/70 to-transparent" />
      </div>

      {/* Input de Envio */}
      <div className="p-3 sm:p-4 border-t border-border/50 shrink-0 bg-card">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Pergunte sobre seus gastos, receitas ou cortes..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isTyping}
            className="h-10 text-xs sm:text-sm"
          />
          <Button
            type="button"
            onClick={() => handleSendMessage()}
            disabled={isTyping || !inputText.trim()}
            size="sm"
            className="h-10 px-3 shrink-0 shadow-sm"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
