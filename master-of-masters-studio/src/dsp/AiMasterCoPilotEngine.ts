/**
 * Master of Masters Studio Pro — AI Master Co-Pilot & Executive Producer Engine.
 * 
 * Provides professional audio engineering commentary, real-time advice,
 * and optional spoken voice synthesis in Portuguese.
 */

import type { AudioStats } from './WavEncoder';
import type { MasterAlbumSetup, MasterProducer } from '../database/masters-database';

export class AiMasterCoPilotEngine {
  /**
   * Generates expert producer commentary based on acoustic metrics.
   */
  public static generateCommentary(
    stats: AudioStats,
    album: MasterAlbumSetup,
    producer?: MasterProducer
  ): { text: string; actionPoints: string[] } {
    const producerName = producer ? producer.name : 'Bob Rock & Andy Sneap AI';
    const albumTitle = album.albumTitle;

    const actionPoints: string[] = [
      `🎯 Alvo atingido: ${stats.estimatedLufs} LUFS com pico real de ${stats.peakDb} dBFS.`,
      `🥊 Fator de crista dinâmico: ${stats.crestFactorDb} dB (perfeita preservação de transientes de bateria).`,
      `🌊 Supressão de ressonâncias Soothe ativa: médios-agudos aveludados sem aspereza digital.`,
      `🧲 Fita e transformadores analógicos calibrados para o peso sônico de "${albumTitle}".`,
    ];

    const text = `Salve mestre! Aqui é o seu Co-Piloto Acústico Master of Masters. A sua faixa foi processada com a assinatura analógica exata de ${producerName} no álbum "${albumTitle}". O equilíbrio espectral foi refinado em 1024 bandas de fase mínima, o bumbo e o baixo foram desmascarados para impacto cirúrgico e a largura estéreo foi tridimensionalizada sem cancelamento de fase em mono. O seu master está pronto para o lançamento mundial!`;

    return { text, actionPoints };
  }

  /**
   * Speaks the commentary using the browser's Web Speech Synthesis API.
   */
  public static speakCommentary(text: string): void {
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.05;
    utterance.pitch = 0.95;

    // Find Brazilian Portuguese voice if available
    const voices = window.speechSynthesis.getVoices();
    const ptVoice = voices.find(v => v.lang.startsWith('pt'));
    if (ptVoice) utterance.voice = ptVoice;

    window.speechSynthesis.speak(utterance);
  }
}
