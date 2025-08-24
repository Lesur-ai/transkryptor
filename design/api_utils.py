#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Utilitaires pour les Appels API de Transkryptor.

Ce module fournit des fonctions pour interagir avec l'API de transcription
audio de LLMaaS (compatible Whisper), y compris la gestion des requêtes
asynchrones avec `httpx` et la gestion des erreurs.
"""

import httpx
import asyncio
import os
import random
import re
from typing import Optional, Dict, Any, Union, BinaryIO
import json # Pour le mode debug

# Importer les fonctions d'affichage depuis cli_ui pour les messages
# Utilisation d'imports directs car tous les modules sont dans le même répertoire
from cli_ui import print_message, print_debug_data
from prompts import REWORK_CONTEXT_ADDON
# Note: Les types Union, Dict sont déjà importés globalement depuis `typing` dans ce fichier.

# Nombre maximum de tentatives pour une requête API
MAX_RETRIES = 3
# Délai initial entre les tentatives en secondes
INITIAL_RETRY_DELAY = 5 

async def transcribe_chunk_api(
    client: httpx.AsyncClient,
    api_url: str,
    api_key: str,
    chunk_index: int,
    chunk_filename: str, # Nom de fichier pour l'API, ex: "chunk_01.wav"
    chunk_data: BinaryIO, # Buffer en mémoire contenant les données WAV du chunk
    language: Optional[str] = None,
    prompt: Optional[str] = None,
    silent: bool = False,
    debug_mode: bool = False
) -> Optional[str]:
    """
    Envoie un morceau (chunk) audio à l'API de transcription et retourne le texte transcrit.
    Gère les tentatives en cas d'échec.

    Args:
        client (httpx.AsyncClient): Client HTTPX asynchrone.
        api_url (str): URL de l'API de transcription.
        api_key (str): Clé API pour l'authentification.
        chunk_index (int): Index du morceau (pour l'affichage).
        chunk_filename (str): Nom de fichier à utiliser pour le champ 'file' dans la requête multipart.
        chunk_data (BinaryIO): Données binaires du morceau audio (format WAV).
        language (Optional[str]): Code langue (ex: "fr", "en").
        prompt (Optional[str]): Prompt pour guider la transcription.
        silent (bool): Si True, supprime les messages d'information.
        debug_mode (bool): Si True, active les messages de débogage.

    Returns:
        Optional[str]: Le texte transcrit, ou None en cas d'échec après toutes les tentatives.
    """
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json"
    }
    
    files = {"file": (chunk_filename, chunk_data, "audio/wav")}
    data: Dict[str, Any] = {"model": "whisper-1"} # Modèle par défaut, l'API LLMaaS le gère

    if language:
        data["language"] = language
    if prompt:
        data["prompt"] = prompt
    
    # Ajout d'autres paramètres Whisper si nécessaire, ex: temperature, response_format
    # data["temperature"] = 0 # Pour une transcription plus déterministe
    # data["response_format"] = "json" # Déjà attendu par défaut

    if debug_mode and not silent:
        debug_payload_data = data.copy()
        # Ne pas logger le contenu binaire du fichier, juste son nom et type
        debug_payload_files = {"file_name": chunk_filename, "content_type": "audio/wav"}
        print_debug_data(f"Chunk {chunk_index+1} - Requête API Préparée", 
                         {"url": api_url, "headers": {"Authorization": f"Bearer {api_key[:10]}..."}, 
                          "data": debug_payload_data, "files_metadata": debug_payload_files},
                         silent=silent, debug_mode=debug_mode)

    for attempt in range(MAX_RETRIES):
        try:
            chunk_data.seek(0) # S'assurer que le buffer est lu depuis le début à chaque tentative
            response = await client.post(api_url, headers=headers, files=files, data=data, timeout=180.0) # Timeout de 3 minutes par chunk
            
            if debug_mode and not silent:
                response_headers_for_debug = dict(response.headers)
                try:
                    response_json_for_debug = response.json()
                except json.JSONDecodeError:
                    response_json_for_debug = response.text
                print_debug_data(f"Chunk {chunk_index+1} - Réponse API (Tentative {attempt+1})",
                                 {"status_code": response.status_code, 
                                  "headers": response_headers_for_debug,
                                  "body": response_json_for_debug},
                                 silent=silent, debug_mode=debug_mode)

            response.raise_for_status()  # Lève une exception pour les codes d'erreur HTTP 4xx/5xx
            
            # L'API LLMaaS /v1/audio/transcriptions retourne directement le JSON de Whisper
            # qui contient une clé "text".
            transcription_json = response.json()
            transcribed_text = transcription_json.get("text")

            if transcribed_text is None:
                print_message(f"Chunk {chunk_index+1}: Réponse API OK mais pas de texte trouvé. Réponse: {transcription_json}", style="warning", silent=silent, debug_mode=debug_mode)
                return "" # Retourner une chaîne vide pour ne pas casser la jointure
            
            print_message(f"Chunk {chunk_index+1} transcrit avec succès.", style="success", silent=silent, debug_mode=debug_mode)
            return transcribed_text.strip()

        except httpx.HTTPStatusError as e:
            print_message(f"Chunk {chunk_index+1}: Erreur API (HTTP {e.response.status_code}) lors de la tentative {attempt+1}/{MAX_RETRIES}. Réponse: {e.response.text}", style="error", silent=silent, debug_mode=debug_mode)
            if e.response.status_code == 401:
                print_message("Erreur d'authentification. Vérifiez votre clé API.", style="error", silent=silent, debug_mode=debug_mode)
                return None # Pas de retry pour une erreur 401
            
            # Si ce n'est pas la dernière tentative, on calcule le délai et on attend
            if attempt < MAX_RETRIES - 1:
                # Backoff exponentiel avec jitter
                delay = (INITIAL_RETRY_DELAY * (2 ** attempt)) + random.uniform(0, 1)

                # Gérer le cas spécifique du "Too Many Requests" (429) en augmentant le délai
                if e.response.status_code == 429:
                    print_message("Limite de requêtes atteinte (429). Application d'un délai plus long.", style="warning", silent=silent, debug_mode=debug_mode)
                    delay *= 2 # On double le délai calculé

                print_message(f"Nouvelle tentative dans {delay:.2f}s...", style="warning", silent=silent, debug_mode=debug_mode)
                await asyncio.sleep(delay)
            else:
                print_message(f"Chunk {chunk_index+1}: Échec de la transcription après {MAX_RETRIES} tentatives.", style="error", silent=silent, debug_mode=debug_mode)
                return None
        except httpx.RequestError as e:
            print_message(f"Chunk {chunk_index+1}: Erreur de requête (Tentative {attempt+1}/{MAX_RETRIES}): {e}", style="error", silent=silent, debug_mode=debug_mode)
            if attempt < MAX_RETRIES - 1:
                delay = (INITIAL_RETRY_DELAY * (2 ** attempt)) + random.uniform(0, 1)
                print_message(f"Nouvelle tentative dans {delay:.2f}s...", style="warning", silent=silent, debug_mode=debug_mode)
                await asyncio.sleep(delay)
            else:
                print_message(f"Chunk {chunk_index+1}: Échec de la transcription après {MAX_RETRIES} tentatives (erreur réseau/connexion).", style="error", silent=silent, debug_mode=debug_mode)
                return None
        except json.JSONDecodeError:
            print_message(f"Chunk {chunk_index+1}: Impossible de décoder la réponse JSON de l'API (Tentative {attempt+1}/{MAX_RETRIES}). Réponse brute: {response.text[:200]}...", style="error", silent=silent, debug_mode=debug_mode)
            # Pas de retry sur une réponse non-JSON, car c'est probablement une erreur serveur inattendue
            return None
        except Exception as e:
            print_message(f"Chunk {chunk_index+1}: Erreur inattendue lors de la transcription (Tentative {attempt+1}/{MAX_RETRIES}): {e}", style="error", silent=silent, debug_mode=debug_mode)
            if attempt < MAX_RETRIES - 1:
                delay = (INITIAL_RETRY_DELAY * (2 ** attempt)) + random.uniform(0, 1)
                print_message(f"Nouvelle tentative dans {delay:.2f}s...", style="warning", silent=silent, debug_mode=debug_mode)
                await asyncio.sleep(delay)
            else:
                print_message(f"Chunk {chunk_index+1}: Échec de la transcription après {MAX_RETRIES} tentatives (erreur inattendue).", style="error", silent=silent, debug_mode=debug_mode)
                return None
    return None # Si toutes les tentatives échouent

async def rework_transcription(
    client: httpx.AsyncClient,
    chat_api_url: str,
    api_key: str,
    transcription_text: str,
    rework_prompt: str,
    rework_model: str,
    silent: bool = False,
    debug_mode: bool = False,
    context_sentence: Optional[str] = None
) -> Optional[str]:
    """
    Envoie une transcription à un modèle de langage pour la raffiner.

    Args:
        client (httpx.AsyncClient): Client HTTPX asynchrone.
        api_url (str): URL de l'API de chat.
        api_key (str): Clé API pour l'authentification.
        transcription_text (str): Le texte de la transcription à raffiner.
        rework_prompt (str): Le prompt pour guider le raffinement.
        silent (bool): Si True, supprime les messages d'information.
        debug_mode (bool): Si True, active les messages de débogage.

    Returns:
        Optional[str]: Le texte raffiné, ou None en cas d'échec.
    """
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    final_prompt = rework_prompt
    if context_sentence:
        final_prompt += REWORK_CONTEXT_ADDON.format(context_sentence=context_sentence)

    payload = {
        "model": rework_model,
        "messages": [
            {"role": "system", "content": final_prompt},
            {"role": "user", "content": transcription_text}
        ]
    }

    if debug_mode and not silent:
        print_debug_data("Requête de Rework Préparée", 
                         {"url": chat_api_url, "headers": {"Authorization": f"Bearer {api_key[:10]}..."}, 
                          "payload": payload},
                         silent=silent, debug_mode=debug_mode)

    for attempt in range(MAX_RETRIES):
        try:
            response = await client.post(chat_api_url, headers=headers, json=payload, timeout=180.0)
            
            if debug_mode and not silent:
                response_headers_for_debug = dict(response.headers)
                try:
                    response_json_for_debug = response.json()
                except json.JSONDecodeError:
                    response_json_for_debug = response.text
                print_debug_data(f"Réponse API de Rework (Tentative {attempt+1})",
                                 {"status_code": response.status_code, 
                                  "headers": response_headers_for_debug,
                                  "body": response_json_for_debug},
                                 silent=silent, debug_mode=debug_mode)

            response.raise_for_status()
            
            full_response_text = response.json()["choices"][0]["message"]["content"]
            
            # Exclure le contenu des balises <think>
            reworked_text = re.sub(r'<think>.*?</think>', '', full_response_text, flags=re.DOTALL)
            
            print_message("Rework de la transcription réussi.", style="success", silent=silent, debug_mode=debug_mode)
            return reworked_text.strip()

        except (httpx.HTTPStatusError, httpx.RequestError) as e:
            print_message(f"Erreur API lors du rework (Tentative {attempt+1}/{MAX_RETRIES}): {e}", style="error", silent=silent, debug_mode=debug_mode)
            if attempt < MAX_RETRIES - 1:
                delay = (INITIAL_RETRY_DELAY * (2 ** attempt)) + random.uniform(0, 1)
                print_message(f"Nouvelle tentative de rework dans {delay:.2f}s...", style="warning", silent=silent, debug_mode=debug_mode)
                await asyncio.sleep(delay)
            else:
                print_message(f"Échec du rework après {MAX_RETRIES} tentatives.", style="error", silent=silent, debug_mode=debug_mode)
                return None
        except (KeyError, IndexError, json.JSONDecodeError) as e:
            print_message(f"Erreur lors du parsing de la réponse de rework: {e}", style="error", silent=silent, debug_mode=debug_mode)
            return None
    return None

if __name__ == '__main__':
    # Section de test pour api_utils.py
    # Nécessite une clé API valide et une URL API fonctionnelle.
    # Vous pouvez configurer cela dans un .env ou les passer en dur pour tester.
    # Assurez-vous d'avoir un fichier audio chunk (ex: test_chunk.wav)

    async def main_test():
        print_message("--- Test de api_utils.py ---", style="info", debug_mode=True)
        
        # Charger la configuration (simulé ici, normalement depuis config.json ou CLI)
        # ATTENTION: Pour tester, remplacez par vos vraies valeurs ou chargez depuis un .env
        API_KEY = os.getenv("LLMAAS_API_KEY_TEST", "VOTRE_CLE_API_POUR_TEST") 
        API_URL = os.getenv("LLMAAS_API_URL_TEST", "https://api.ai.cloud-temple.com/v1/audio/transcriptions")

        if API_KEY == "VOTRE_CLE_API_POUR_TEST":
            print_message("Clé API de test non configurée. Veuillez définir LLMAAS_API_KEY_TEST.", style="error", debug_mode=True)
            return

        # Créer un faux chunk WAV en mémoire pour le test
        try:
            from pydub import AudioSegment
            from pydub.generators import Sine
            import io

            fake_chunk_audio = Sine(440).to_audio_segment(duration=2000).set_channels(1) # 2 secondes
            fake_wav_buffer = io.BytesIO()
            fake_chunk_audio.export(fake_wav_buffer, format="wav")
            fake_wav_buffer.seek(0)
            print_message("Faux chunk WAV créé en mémoire pour le test.", style="info", debug_mode=True)

        except ImportError:
            print_message("Pydub non trouvé, impossible de créer un faux chunk pour le test.", style="error", debug_mode=True)
            return
        except Exception as e:
            print_message(f"Erreur lors de la création du faux chunk: {e}", style="error", debug_mode=True)
            return

        async with httpx.AsyncClient() as client:
            transcription = await transcribe_chunk_api(
                client=client,
                api_url=API_URL,
                api_key=API_KEY,
                chunk_index=0,
                chunk_filename="test_chunk_01.wav",
                chunk_data=fake_wav_buffer,
                language="fr", # Spécifiez une langue pour le test
                debug_mode=True,
                silent=False
            )

            if transcription is not None:
                print_message(f"Transcription du chunk de test: '{transcription}'", style="success", debug_mode=True)
            else:
                print_message("Échec de la transcription du chunk de test.", style="error", debug_mode=True)
        
        print_message("--- Fin des tests de api_utils.py ---", style="info", debug_mode=True)

    if os.name == 'nt': # Pour Windows, politique différente pour asyncio
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main_test())
