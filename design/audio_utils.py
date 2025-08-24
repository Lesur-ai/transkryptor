#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Utilitaires pour la Manipulation Audio pour Transkryptor.

Ce module fournit des fonctions pour charger des fichiers audio, les découper
en morceaux (chunks) avec chevauchement, et les préparer pour l'envoi
à une API de transcription. Il utilise Pydub pour la manipulation audio.
"""

import os
from pydub import AudioSegment
from pydub.exceptions import CouldntDecodeError
import io
from typing import List, Tuple, Optional, Union, Dict # Ajout de Union et Dict ici pour une utilisation globale si nécessaire

# Importer les fonctions d'affichage depuis cli_ui pour les messages
# Utilisation d'imports directs car tous les modules sont dans le même répertoire
from cli_ui import print_message, print_debug_data

def load_audio(file_path: str, target_sample_rate: int = 16000, silent: bool = False, debug_mode: bool = False) -> Optional[AudioSegment]:
    """
    Charge un fichier audio à partir du chemin spécifié.

    Tente de déduire le format à partir de l'extension.
    Supporte divers formats grâce à Pydub (nécessite ffmpeg pour certains).

    Args:
        file_path (str): Chemin vers le fichier audio.
        target_sample_rate (int): Fréquence d'échantillonnage cible en Hz (défaut: 16000).
        silent (bool): Si True, supprime les messages d'information.
        debug_mode (bool): Si True, active les messages de débogage.

    Returns:
        Optional[AudioSegment]: Un objet AudioSegment si le chargement réussit, sinon None.
    """
    print_message(f"Chargement du fichier audio : {file_path}", silent=silent, debug_mode=debug_mode)
    if not os.path.exists(file_path):
        print_message(f"Le fichier audio '{file_path}' n'existe pas.", style="error", silent=silent, debug_mode=debug_mode)
        return None
    
    try:
        # Extraire l'extension pour aider Pydub si nécessaire, bien qu'il soit bon en auto-détection
        file_format = os.path.splitext(file_path)[1].lower().replace('.', '')
        if not file_format: # Au cas où il n'y a pas d'extension
            print_message(f"Aucune extension de fichier détectée pour {file_path}. Pydub tentera une détection automatique.", style="warning", silent=silent, debug_mode=debug_mode)
            audio = AudioSegment.from_file(file_path)
        else:
            audio = AudioSegment.from_file(file_path, format=file_format)
        
        print_message(f"Fichier '{os.path.basename(file_path)}' chargé. Durée: {len(audio) / 1000:.2f}s, Canaux d'origine: {audio.channels}, Fréquence d'origine: {audio.frame_rate}Hz", style="success", silent=silent, debug_mode=debug_mode)
        
        # Normalisation de l'audio pour réduire la taille et optimiser pour Whisper
        # 1. Conversion en mono si nécessaire
        if audio.channels > 1:
            print_message("Conversion de l'audio en mono.", style="info", silent=silent, debug_mode=debug_mode)
            audio = audio.set_channels(1)
            if debug_mode and not silent:
                print_debug_data("Audio après conversion mono", f"Canaux: {audio.channels}", silent=silent, debug_mode=debug_mode)

        # 2. Rééchantillonnage à la fréquence cible si nécessaire
        if audio.frame_rate != target_sample_rate:
            print_message(f"Rééchantillonnage de l'audio de {audio.frame_rate}Hz à {target_sample_rate}Hz.", style="info", silent=silent, debug_mode=debug_mode)
            audio = audio.set_frame_rate(target_sample_rate)
            if debug_mode and not silent:
                print_debug_data("Audio après rééchantillonnage", f"Fréquence: {audio.frame_rate}Hz", silent=silent, debug_mode=debug_mode)
        
        print_message(f"Audio normalisé. Canaux: {audio.channels}, Fréquence: {audio.frame_rate}Hz.", style="info", silent=silent, debug_mode=debug_mode)
            
        return audio
    except CouldntDecodeError:
        print_message(f"Impossible de décoder le fichier audio '{file_path}'. Assurez-vous que ffmpeg est installé et que le fichier n'est pas corrompu.", style="error", silent=silent, debug_mode=debug_mode)
        return None
    except Exception as e:
        print_message(f"Erreur inattendue lors du chargement de '{file_path}': {e}", style="error", silent=silent, debug_mode=debug_mode)
        return None

def split_audio_into_chunks(
    audio: AudioSegment, 
    chunk_duration_ms: int, 
    overlap_ms: int,
    silent: bool = False,
    debug_mode: bool = False
) -> List[Tuple[AudioSegment, float, float]]:
    """
    Découpe un AudioSegment en plusieurs morceaux (chunks) avec un chevauchement spécifié.

    Args:
        audio (AudioSegment): L'objet audio à découper.
        chunk_duration_ms (int): Durée de chaque morceau en millisecondes.
        overlap_ms (int): Durée du chevauchement entre les morceaux en millisecondes.
        silent (bool): Si True, supprime les messages d'information.
        debug_mode (bool): Si True, active les messages de débogage.

    Returns:
        List[Tuple[AudioSegment, float, float]]: Une liste de tuples, où chaque tuple contient
                                                 un AudioSegment pour le morceau, son temps de début
                                                 et son temps de fin en secondes.
    """
    if chunk_duration_ms <= overlap_ms:
        raise ValueError("La durée du chevauchement ne peut pas être supérieure ou égale à la durée du morceau.")

    chunks_data: List[Tuple[AudioSegment, float, float]] = []
    audio_len_ms = len(audio)
    
    print_message(f"Découpage de l'audio ({audio_len_ms / 1000:.2f}s) en morceaux de {chunk_duration_ms / 1000:.1f}s avec {overlap_ms / 1000:.1f}s de chevauchement.", silent=silent, debug_mode=debug_mode)

    start_ms = 0
    chunk_idx = 0
    while start_ms < audio_len_ms:
        end_ms = start_ms + chunk_duration_ms
        # S'assurer que le dernier chunk ne dépasse pas la durée de l'audio
        # mais il peut être plus court que chunk_duration_ms
        actual_end_ms = min(end_ms, audio_len_ms)
        
        chunk: AudioSegment = audio[start_ms:actual_end_ms] # type: ignore # Annotation de type explicite, Pylance a du mal avec le slicing Pydub
        chunks_data.append((chunk, start_ms / 1000.0, actual_end_ms / 1000.0))
        
        if debug_mode and not silent:
            print_debug_data(
                f"Chunk {chunk_idx + 1} créé", 
                f"Intervalle: [{start_ms / 1000.0:.2f}s - {actual_end_ms / 1000.0:.2f}s], Durée: {len(chunk) / 1000.0:.2f}s",
                silent=silent,
                debug_mode=debug_mode
            )
        
        if actual_end_ms == audio_len_ms: # Fin de l'audio atteinte
            break
            
        start_ms += (chunk_duration_ms - overlap_ms)
        chunk_idx += 1
        
        # Petite sécurité pour éviter une boucle infinie si overlap_ms >= chunk_duration_ms
        # (déjà géré par la ValueError au début, mais bon à avoir)
        if chunk_duration_ms - overlap_ms <= 0:
            print_message("Erreur critique: progression de start_ms nulle ou négative.", style="error", silent=silent, debug_mode=debug_mode)
            break


    print_message(f"Audio découpé en {len(chunks_data)} morceaux.", style="success", silent=silent, debug_mode=debug_mode)
    return chunks_data

def export_chunk_to_wav_in_memory(chunk: AudioSegment, silent: bool = False, debug_mode: bool = False) -> Optional[io.BytesIO]:
    """
    Exporte un AudioSegment (chunk) au format WAV dans un buffer en mémoire.

    Args:
        chunk (AudioSegment): Le morceau audio à exporter.
        silent (bool): Si True, supprime les messages d'information.
        debug_mode (bool): Si True, active les messages de débogage.

    Returns:
        Optional[io.BytesIO]: Un buffer BytesIO contenant les données WAV, ou None en cas d'erreur.
    """
    try:
        wav_buffer = io.BytesIO()
        # Exporter en WAV. Pydub s'assure que c'est PCM 16-bit par défaut.
        # Whisper préfère mono, mais gère le stéréo. On laisse Pydub gérer les canaux.
        chunk.export(wav_buffer, format="wav")
        wav_buffer.seek(0) # Rembobiner le buffer pour la lecture
        
        if debug_mode and not silent:
            print_message(f"Morceau exporté en WAV en mémoire (taille: {len(wav_buffer.getvalue()) / 1024:.2f} KB).", style="debug", silent=silent, debug_mode=debug_mode)
            
        return wav_buffer
    except Exception as e:
        print_message(f"Erreur lors de l'exportation du morceau en WAV: {e}", style="error", silent=silent, debug_mode=debug_mode)
        return None

if __name__ == '__main__':
    # Section de test pour audio_utils.py
    # Assurez-vous d'avoir un fichier audio de test (ex: test_audio.mp3) dans le même répertoire
    # et que ffmpeg est installé si vous utilisez des formats comme mp3.
    
    # Créer un fichier audio de test factice si aucun n'est fourni
    TEST_AUDIO_PATH = "dummy_test_audio.mp3"
    if not os.path.exists(TEST_AUDIO_PATH):
        try:
            # Créer un son de 10 secondes, 440Hz, mono
            from pydub.generators import Sine
            sine_wave = Sine(440).to_audio_segment(duration=10000).set_channels(1) # 10 secondes
            sine_wave.export(TEST_AUDIO_PATH, format="mp3")
            print(f"Fichier audio de test '{TEST_AUDIO_PATH}' créé.")
        except Exception as e:
            print(f"Impossible de créer le fichier audio de test: {e}. Veuillez fournir un fichier audio pour tester.")
            TEST_AUDIO_PATH = None # Empêcher les tests suivants de s'exécuter

    if TEST_AUDIO_PATH:
        print_message("--- Test de audio_utils.py ---", style="info", debug_mode=True)

        # Test de chargement
        audio_segment = load_audio(TEST_AUDIO_PATH, debug_mode=True)
        if audio_segment:
            print_message(f"Durée de l'audio chargé: {len(audio_segment) / 1000.0}s", style="success", debug_mode=True)

            # Test de découpage
            # Morceaux de 3s avec 0.5s de chevauchement
            chunk_duration = 3000 
            overlap = 500
            
            try:
                chunks = split_audio_into_chunks(audio_segment, chunk_duration, overlap, debug_mode=True)
                print_message(f"Nombre de morceaux créés: {len(chunks)}", style="success", debug_mode=True)

                if chunks:
                    # Test d'exportation du premier morceau
                    first_chunk_segment, start_time, end_time = chunks[0]
                    print_message(f"Premier morceau: de {start_time:.2f}s à {end_time:.2f}s, durée {len(first_chunk_segment)/1000.0:.2f}s", debug_mode=True)
                    
                    wav_buffer = export_chunk_to_wav_in_memory(first_chunk_segment, debug_mode=True)
                    if wav_buffer:
                        print_message("Premier morceau exporté en WAV en mémoire avec succès.", style="success", debug_mode=True)
                        # Vous pourriez sauvegarder ce buffer dans un fichier pour vérifier
                        # with open("test_first_chunk.wav", "wb") as f:
                        #     f.write(wav_buffer.getvalue())
                        # print_message("Premier morceau sauvegardé dans test_first_chunk.wav", debug_mode=True)
                    else:
                        print_message("Échec de l'exportation du premier morceau.", style="error", debug_mode=True)
            except ValueError as ve:
                print_message(f"Erreur de configuration du découpage: {ve}", style="error", debug_mode=True)
        else:
            print_message(f"Échec du chargement de {TEST_AUDIO_PATH}. Tests de découpage et d'exportation annulés.", style="error", debug_mode=True)
        
        # Nettoyage du fichier de test factice
        if TEST_AUDIO_PATH == "dummy_test_audio.mp3" and os.path.exists(TEST_AUDIO_PATH):
            os.remove(TEST_AUDIO_PATH)
            print(f"Fichier audio de test '{TEST_AUDIO_PATH}' supprimé.")
            
    print_message("--- Fin des tests de audio_utils.py ---", style="info", debug_mode=True)
