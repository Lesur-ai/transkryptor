#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Transkryptor Python CLI - Transcription Audio Avancée.

Ce script transcrit des fichiers audio en utilisant l'API LLMaaS.
Il gère les gros fichiers par découpage, parallélise les requêtes par lots,
et offre une interface utilisateur soignée avec modes debug et silent.
Nouvelles fonctionnalités : écriture au fur et à mesure et prévisualisation temps réel.
"""

import os
import argparse
import asyncio
import httpx
import json
import time
import sys
import threading
import queue
from pathlib import Path
from dotenv import load_dotenv
from typing import List, Dict, Any, Optional, Tuple, TextIO

# Importations des modules locaux
from cli_ui import print_message, print_debug_data, get_progress_bar, console
from audio_utils import load_audio, split_audio_into_chunks, export_chunk_to_wav_in_memory
from api_utils import transcribe_chunk_api, rework_transcription
from prompts import SYSTEM_PROMPT

# Rich components pour la prévisualisation terminal
from rich.live import Live
from rich.panel import Panel
from rich.text import Text
from rich.layout import Layout
from rich.align import Align

# Classe pour les couleurs ANSI
class TermColors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'
    DEBUG = '\033[90m'

# --- Configuration par défaut ---
DEFAULT_CONFIG_FILENAME = "config.json"
DEFAULT_CHUNK_DURATION_MS = 30000  # 30 secondes
DEFAULT_CHUNK_OVERLAP_MS = 2000    # 2 secondes
DEFAULT_BATCH_SIZE = 1             # Mise à jour de la taille de lot par défaut à 1
DEFAULT_SAMPLE_RATE_HZ = 24000     # Fréquence d'échantillonnage par défaut en Hz
DEFAULT_OUTPUT_DIR = "./transkryptor_outputs"

class TerminalPreview:
    """Prévisualisation de la transcription en temps réel dans le terminal."""
    
    def __init__(self, audio_filename: str):
        self.audio_filename = os.path.basename(audio_filename)
        self.full_transcription = ""  # Texte complet
        self.total_chunks = 0
        self.processed_chunks = 0
        self.status_text = "Initialisation..."
        self.layout = Layout()
        self.running = True
        self.live_display = None
        self.last_update_time = 0
        self._setup_layout()
    
    def _setup_layout(self):
        """Configure le layout Rich pour l'affichage."""
        self.layout.split_column(
            Layout(name="header", size=3),
            Layout(name="progress", size=4),
            Layout(name="content"),
            Layout(name="footer", size=1)
        )
        
        # Header
        self.layout["header"].update(
            Panel(
                Align.center(f"🎙️ [bold blue]Transkryptor - Transcription en Temps Réel[/bold blue]\n[dim]{self.audio_filename}[/dim]"),
                title="📼 Audio"
            )
        )
        
        # Footer avec instructions (plus compact)
        self.layout["footer"].update(
            Panel("[dim]Ctrl+C pour arrêter[/dim]", style="dim")
        )
    
    def _update_progress_panel(self):
        """Met à jour le panneau de progression."""
        if self.total_chunks > 0:
            percentage = (self.processed_chunks / self.total_chunks) * 100
            progress_bar = "█" * int(percentage / 2) + "░" * (50 - int(percentage / 2))
            progress_text = f"[green]█[/green]{progress_bar}[green]█[/green] {percentage:.1f}% ({self.processed_chunks}/{self.total_chunks} chunks)"
        else:
            progress_text = "Préparation..."
        
        self.layout["progress"].update(
            Panel(
                f"{progress_text}\n[blue]{self.status_text}[/blue]",
                title="📊 Progression"
            )
        )
    
    def _get_display_text(self):
        """Retourne le texte à afficher avec gestion intelligente du scroll."""
        if not self.full_transcription.strip():
            return "[dim]Transcription en cours...[/dim]"
        
        # Calculer la taille approximative de l'affichage (lignes disponibles)
        # On garde les derniers caractères pour un effet de scroll naturel
        max_chars = 3000  # Augmenté pour plus de contexte
        
        if len(self.full_transcription) <= max_chars:
            return self.full_transcription
        else:
            # Scroll automatique : on garde les derniers caractères
            # mais on essaie de ne pas couper au milieu d'un mot
            truncated = self.full_transcription[-max_chars:]
            
            # Trouver le premier espace pour éviter de couper un mot
            space_index = truncated.find(' ')
            if space_index > 0 and space_index < 100:  # Si on trouve un espace dans les 100 premiers caractères
                truncated = truncated[space_index+1:]
            
            return "..." + truncated
    
    def _update_content_panel(self):
        """Met à jour le panneau de contenu avec la transcription."""
        display_text = self._get_display_text()
        
        self.layout["content"].update(
            Panel(
                Text(display_text),
                title=f"📝 Transcription ({len(self.full_transcription)} caractères)",
                border_style="green"
            )
        )
        
        # Forcer la mise à jour de l'affichage
        if self.live_display:
            try:
                self.live_display.refresh()
            except:
                pass
    
    def set_total_chunks(self, total: int):
        """Définit le nombre total de chunks à traiter."""
        self.total_chunks = total
        self._update_progress_panel()
    
    def add_transcription(self, chunk_index: int, text: str):
        """Ajoute du texte à la transcription avec accumulation et scroll automatique."""
        if text and text.strip():
            # Ajouter un espace si ce n'est pas le premier texte
            if self.full_transcription:
                self.full_transcription += " "
            
            # Ajouter le nouveau texte
            self.full_transcription += text.strip()
            
            # Mettre à jour l'affichage immédiatement
            self._update_content_panel()
    
    def increment_progress(self):
        """Incrémente le compteur de progression."""
        self.processed_chunks += 1
        self._update_progress_panel()
    
    def set_status(self, status: str, color: str = "blue"):
        """Met à jour le statut affiché."""
        self.status_text = status
        self._update_progress_panel()
    
    def show(self):
        """Lance l'affichage en temps réel dans le terminal."""
        def update_display():
            while self.running:
                try:
                    # Mise à jour moins fréquente de la progression pour éviter le scintillement
                    current_time = time.time()
                    if current_time - self.last_update_time > 1.0:  # Mise à jour toutes les secondes
                        self._update_progress_panel()
                        self.last_update_time = current_time
                    time.sleep(0.2)  # Vérification plus fréquente mais mise à jour moins fréquente
                except:
                    break
        
        # Démarrer le thread de mise à jour
        update_thread = threading.Thread(target=update_display, daemon=True)
        update_thread.start()
        
        # Démarrer l'affichage Live de Rich
        try:
            self.live_display = Live(self.layout, refresh_per_second=4, screen=True)
            self.live_display.start()
        except Exception as e:
            # Fallback : affichage simple sans Live si ça ne marche pas
            print_message(f"Impossible d'utiliser l'affichage Live Rich: {e}", style="warning")
            self.live_display = None
    
    def stop(self):
        """Arrête l'affichage."""
        self.running = False
        if self.live_display:
            try:
                self.live_display.stop()
            except:
                pass
    
    def get_full_text(self):
        """Retourne le texte complet de la transcription."""
        return self.full_transcription

class StreamingFileWriter:
    """Gestionnaire pour écrire dans un fichier au fur et à mesure."""
    
    def __init__(self, file_path: Optional[str], output_dir: str):
        self.file_handle: Optional[TextIO] = None
        self.file_path = None
        
        if file_path:
            path = Path(file_path)
            if not path.is_absolute():
                output_dir_path = Path(output_dir)
                output_dir_path.mkdir(parents=True, exist_ok=True)
                path = output_dir_path / Path(os.path.basename(file_path))
            else:
                path.parent.mkdir(parents=True, exist_ok=True)
            
            try:
                self.file_handle = open(path, 'w', encoding='utf-8', buffering=1)  # Line buffering
                self.file_path = str(path)
            except IOError as e:
                print_message(f"Erreur lors de l'ouverture du fichier de sortie '{path}': {e}", 
                            style="error")
                self.file_handle = None
    
    def write_text(self, text: str):
        """Écrit du texte dans le fichier si disponible."""
        if self.file_handle and text.strip():
            # Ajouter un espace si le fichier n'est pas vide
            if self.file_handle.tell() > 0:
                self.file_handle.write(" ")
            self.file_handle.write(text.strip())
            self.file_handle.flush()  # Force l'écriture immédiate
    
    def close(self):
        """Ferme le fichier."""
        if self.file_handle:
            self.file_handle.close()
            self.file_handle = None
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

def load_configuration(config_path: Optional[str], silent: bool, debug_mode: bool) -> Dict[str, Any]:
    """Charge la configuration depuis un fichier JSON et les variables d'environnement."""
    config = {
        "api_url": None,
        "api_key": None,
        "default_language": "fr",
        "default_prompt": "",
        "chunk_duration_ms": DEFAULT_CHUNK_DURATION_MS,
        "chunk_overlap_ms": DEFAULT_CHUNK_OVERLAP_MS,
        "batch_size": DEFAULT_BATCH_SIZE,
        "sample_rate_hz": DEFAULT_SAMPLE_RATE_HZ,
        "output_directory": DEFAULT_OUTPUT_DIR,
        "rework_enabled": False,
        "rework_follow": False,
        "rework_model": "qwen3:14b",
        "rework_prompt": ""
    }

    load_dotenv()
    env_api_key = os.getenv("LLMAAS_API_KEY")
    env_api_url = os.getenv("LLMAAS_API_URL")

    if env_api_key:
        config["api_key"] = env_api_key
    if env_api_url:
        config["api_url"] = env_api_url
    
    actual_config_path = config_path or os.path.join(os.path.dirname(__file__), DEFAULT_CONFIG_FILENAME)
    
    if os.path.exists(actual_config_path):
        try:
            with open(actual_config_path, 'r', encoding='utf-8') as f:
                file_config = json.load(f)
            
            config["api_url"] = file_config.get("api_url", config["api_url"])
            config["api_key"] = file_config.get("api_token", config["api_key"]) # 'api_token' dans JSON
            config["default_language"] = file_config.get("default_language", config["default_language"])
            config["default_prompt"] = file_config.get("default_prompt", config["default_prompt"])
            config["chunk_duration_ms"] = file_config.get("chunk_duration_ms", config["chunk_duration_ms"])
            config["chunk_overlap_ms"] = file_config.get("chunk_overlap_ms", config["chunk_overlap_ms"])
            config["batch_size"] = file_config.get("batch_size", config["batch_size"])
            config["sample_rate_hz"] = file_config.get("sample_rate_hz", config["sample_rate_hz"])
            config["output_directory"] = file_config.get("output_directory", config["output_directory"])
            
            # Charger les nouvelles options de rework
            config["rework_enabled"] = file_config.get("rework_enabled", config["rework_enabled"])
            config["rework_follow"] = file_config.get("rework_follow", config["rework_follow"])
            config["rework_model"] = file_config.get("rework_model", config["rework_model"])
            config["rework_prompt"] = file_config.get("rework_prompt", config["rework_prompt"])

            print_message(f"Configuration chargée depuis '{actual_config_path}'.", silent=silent, debug_mode=debug_mode)
        except json.JSONDecodeError:
            print_message(f"Erreur de décodage JSON dans '{actual_config_path}'. Utilisation des valeurs par défaut/CLI.", style="error", silent=silent, debug_mode=debug_mode)
        except Exception as e:
            print_message(f"Erreur lors du chargement de '{actual_config_path}': {e}. Utilisation des valeurs par défaut/CLI.", style="error", silent=silent, debug_mode=debug_mode)
    elif config_path and config_path != DEFAULT_CONFIG_FILENAME : # Si un chemin spécifique a été donné et n'existe pas
        print_message(f"Fichier de configuration '{config_path}' non trouvé. Utilisation des valeurs par défaut/CLI.", style="warning", silent=silent, debug_mode=debug_mode)
    
    return config

async def process_batch(
    batch_chunks_data: List[Tuple[Any, float, float, int, str]], 
    http_client: httpx.AsyncClient,
    api_url: str,
    api_key: str,
    language: Optional[str],
    prompt: Optional[str],
    batch_progress_task_id,
    progress,
    silent: bool,
    debug_mode: bool,
    preview_window: Optional[TerminalPreview] = None,
    file_writer: Optional[StreamingFileWriter] = None
) -> List[Optional[str]]:
    """Traite un lot de chunks en parallèle."""
    tasks = []
    for chunk_audio, _start_time, _end_time, original_idx, chunk_filename in batch_chunks_data:
        wav_buffer = export_chunk_to_wav_in_memory(chunk_audio, silent=silent, debug_mode=debug_mode)
        if wav_buffer:
            task = transcribe_chunk_api(
                client=http_client, api_url=api_url, api_key=api_key,
                chunk_index=original_idx, chunk_filename=chunk_filename, chunk_data=wav_buffer,
                language=language, prompt=prompt, silent=silent, debug_mode=debug_mode
            )
            tasks.append(task)
        else:
            print_message(f"Échec de l'exportation du chunk {original_idx + 1}, il sera ignoré.", style="error", silent=silent, debug_mode=debug_mode)
            tasks.append(asyncio.sleep(0, result=None)) 

    batch_results = await asyncio.gather(*tasks, return_exceptions=True)
    
    processed_transcriptions = []
    for i, result in enumerate(batch_results):
        chunk_index = batch_chunks_data[i][3]
        
        if isinstance(result, Exception):
            print_message(f"Erreur lors de la transcription du chunk {chunk_index + 1}: {result}", style="error", silent=silent, debug_mode=debug_mode)
            processed_transcriptions.append(None)
        elif result is None:
            processed_transcriptions.append(None)
        else:
            processed_transcriptions.append(result)
            
            # Écriture au fur et à mesure dans le fichier
            if file_writer and isinstance(result, str) and result.strip():
                file_writer.write_text(result)
            
            # Mise à jour de la fenêtre de prévisualisation
            if preview_window and isinstance(result, str) and result.strip():
                preview_window.add_transcription(chunk_index, result)
        
        # Mise à jour de la progression dans la fenêtre de prévisualisation
        if preview_window:
            preview_window.increment_progress()

        # Mise à jour de la barre de progression du lot
        if progress and batch_progress_task_id is not None:
            progress.update(batch_progress_task_id, advance=1)
            
    # Forcer le rafraîchissement de la barre de progression du lot après que tous les chunks du lot soient traités
    if not silent and not debug_mode and progress: # Ne rafraîchir que si les barres sont visibles
        progress.refresh()
            
    return processed_transcriptions

class ColoredHelpFormatter(argparse.RawDescriptionHelpFormatter):
    """Formateur d'aide personnalisé pour colorer la sortie d'aide."""
    def _format_action_invocation(self, action):
        if not action.option_strings or action.nargs == 0:
            return super()._format_action_invocation(action)
        return f"{TermColors.OKCYAN}{', '.join(action.option_strings)}{TermColors.ENDC} {self._format_args(action, self._get_default_metavar_for_optional(action))}"

    def format_help(self):
        help_text = super().format_help()
        help_text = help_text.replace('usage:', f'{TermColors.BOLD}Usage:{TermColors.ENDC}')
        help_text = help_text.replace('options:', f'{TermColors.BOLD}Options:{TermColors.ENDC}')
        help_text = help_text.replace('positional arguments:', f'{TermColors.BOLD}Arguments Positionnels:{TermColors.ENDC}')
        
        return help_text

def run_transcription_pipeline(args):
    """Exécute le pipeline de transcription principal."""
    start_time = time.time()
    
    # Vérifier la compatibilité des modes
    if args.preview and args.debug:
        print_message("Erreur: Les modes --preview et --debug sont incompatibles.", style="error")
        print_message("Le mode preview utilise l'affichage plein écran qui interfère avec les logs de debug.", style="error")
        print_message("Utilisez soit --preview soit --debug, mais pas les deux en même temps.", style="error")
        return
    
    # La prévisualisation terminal ne nécessite pas de vérification spéciale
    # Elle utilise Rich qui est déjà une dépendance
    
    # Assurer que le répertoire du script est utilisé pour trouver config.json par défaut
    script_dir = os.path.dirname(__file__)
    default_config_path_in_script_dir = os.path.join(script_dir, DEFAULT_CONFIG_FILENAME)

    cfg_input_path = args.config_file
    if args.config_file == DEFAULT_CONFIG_FILENAME and not os.path.exists(args.config_file):
        # Si le défaut est utilisé et qu'il n'existe pas dans CWD, vérifier dans le dir du script
        if os.path.exists(default_config_path_in_script_dir):
            cfg_input_path = default_config_path_in_script_dir

    cfg = load_configuration(cfg_input_path, args.silent, args.debug)

    cfg_api_url = args.api_url if args.api_url is not None else cfg["api_url"]
    cfg_api_key = args.api_key if args.api_key is not None else cfg["api_key"]
    cfg_language = args.language if args.language is not None else cfg["default_language"]
    cfg_prompt = args.prompt if args.prompt is not None else cfg["default_prompt"]
    cfg_chunk_duration_ms = args.chunk_duration if args.chunk_duration is not None else cfg["chunk_duration_ms"]
    cfg_chunk_overlap_ms = args.chunk_overlap if args.chunk_overlap is not None else cfg["chunk_overlap_ms"]
    cfg_batch_size = args.batch_size if args.batch_size is not None else cfg["batch_size"]
    cfg_sample_rate_hz = args.sample_rate if args.sample_rate is not None else cfg["sample_rate_hz"]
    cfg_output_directory = args.output_dir if args.output_dir is not None else cfg["output_directory"]
    
    # Résoudre les options de rework (CLI > Fichier config > Défaut)
    cfg_rework = args.rework or cfg["rework_enabled"]
    cfg_rework_follow = args.rework_follow or cfg["rework_follow"]
    
    # Pour le prompt et le modèle, on établit une priorité : CLI > Fichier config > Défaut
    if args.rework_prompt != parser.get_default('rework_prompt'):
        # 1. Priorité au paramètre CLI s'il a été modifié par l'utilisateur
        cfg_rework_prompt = args.rework_prompt
    elif cfg.get("rework_prompt"):
        # 2. Sinon, utiliser la valeur du fichier de configuration si elle n'est pas vide
        cfg_rework_prompt = cfg["rework_prompt"]
    else:
        # 3. En dernier recours, utiliser la valeur par défaut définie dans le parser
        cfg_rework_prompt = parser.get_default('rework_prompt')

    if args.rework_model != parser.get_default('rework_model'):
        cfg_rework_model = args.rework_model
    elif cfg.get("rework_model"):
        cfg_rework_model = cfg["rework_model"]
    else:
        cfg_rework_model = parser.get_default('rework_model')

    audio_file_path = args.audio_file_path
    output_file = args.output_file
    
    # Si aucun fichier de sortie n'est spécifié, en créer un par défaut
    if output_file is None:
        p = Path(audio_file_path)
        output_file = f"transkrypt_{p.stem}.txt"
        print_message(f"Aucun fichier de sortie spécifié. La transcription sera sauvegardée dans : {output_file}", style="info")

    debug_mode = args.debug
    silent_mode = args.silent
    preview_mode = args.preview

    if not cfg_api_url:
        print_message("URL de l'API manquante. Impossible de continuer.", style="error", silent=silent_mode, debug_mode=debug_mode)
        return
    if not cfg_api_key:
        print_message("Clé API manquante. Vérifiez votre configuration (config.json ou var LLMAAS_API_KEY) ou --api-key.", style="error", silent=silent_mode, debug_mode=debug_mode)
        return

    if debug_mode and not silent_mode and not preview_mode:
        print_debug_data("Configuration Active (depuis fichier/env)", cfg, silent=silent_mode or preview_mode, debug_mode=debug_mode)
        resolved_options = {
            "Audio File Path": audio_file_path,
            "Output File": output_file or "Non spécifié (stdout ou auto-généré)",
            "API URL": cfg_api_url, "API Key": f"{cfg_api_key[:5]}..." if cfg_api_key else "Non fournie",
            "Language": cfg_language, "Prompt": cfg_prompt or "Aucun",
            "Chunk Duration": f"{cfg_chunk_duration_ms}ms", "Chunk Overlap": f"{cfg_chunk_overlap_ms}ms",
            "Batch Size": cfg_batch_size, "Sample Rate": f"{cfg_sample_rate_hz}Hz", "Output Directory": cfg_output_directory,
            "Debug Mode": debug_mode, "Silent Mode": silent_mode, "Preview Mode": preview_mode
        }
        print_debug_data("Options Résolues pour la Transcription", resolved_options, silent=silent_mode or preview_mode, debug_mode=debug_mode)

    audio_segment = load_audio(audio_file_path, target_sample_rate=cfg_sample_rate_hz, silent=silent_mode or preview_mode, debug_mode=debug_mode and not preview_mode)
    if not audio_segment:
        return

    try:
        chunks_with_times = split_audio_into_chunks(
            audio_segment, cfg_chunk_duration_ms, cfg_chunk_overlap_ms, silent=silent_mode or preview_mode, debug_mode=debug_mode and not preview_mode
        )
    except ValueError as e:
        print_message(f"Erreur de configuration du découpage: {e}", style="error", silent=silent_mode, debug_mode=debug_mode)
        return
        
    if not chunks_with_times:
        print_message("Aucun morceau audio n'a pu être créé.", style="error", silent=silent_mode, debug_mode=debug_mode)
        return

    num_chunks = len(chunks_with_times)
    num_batches = (num_chunks + cfg_batch_size - 1) // cfg_batch_size

    all_transcriptions: List[str] = [""] * num_chunks
    indexed_chunks_data = [
        (cs[0], cs[1], cs[2], idx, f"chunk_{idx+1:04d}.wav") 
        for idx, cs in enumerate(chunks_with_times)
    ]

    # Initialiser la fenêtre de prévisualisation si demandée
    preview_window = None
    if preview_mode:
        try:
            preview_window = TerminalPreview(audio_file_path)
            preview_window.set_total_chunks(num_chunks)
            preview_window.set_status("Initialisation...", "orange")
            preview_window.show()
            print_message("Fenêtre de prévisualisation ouverte.", style="success", silent=silent_mode, debug_mode=debug_mode)
        except Exception as e:
            print_message(f"Erreur lors de l'ouverture de la fenêtre de prévisualisation: {e}", style="error", silent=silent_mode, debug_mode=debug_mode)
            preview_window = None

    # Initialiser l'écriture de fichier en streaming
    with StreamingFileWriter(output_file, cfg_output_directory) as file_writer:
        if file_writer.file_path:
            print_message(f"Écriture en temps réel activée vers: {file_writer.file_path}", style="info", silent=silent_mode, debug_mode=debug_mode)

        with get_progress_bar(disable=silent_mode or preview_mode) as progress:
            overall_task_id = progress.add_task(f"[cyan]Transcription globale ({num_batches} lots)...", total=num_chunks)
            
            if preview_window:
                preview_window.set_status("Transcription en cours...", "blue")
            
            # Variable pour stocker la fin du dernier rework, définie dans la portée externe
            last_reworked_sentence = None

            async def run_batches_async():
                nonlocal last_reworked_sentence
                async with httpx.AsyncClient() as client:
                    for i in range(num_batches):
                        batch_start_idx = i * cfg_batch_size
                        batch_end_idx = min((i + 1) * cfg_batch_size, num_chunks)
                        current_batch_data = indexed_chunks_data[batch_start_idx:batch_end_idx]
                        
                        # Nouvelle tâche pour la progression des chunks à l'intérieur du lot actuel
                        batch_chunk_task_id = progress.add_task(
                            f"[magenta]Lot {i+1}/{num_batches} (chunks {batch_start_idx+1}-{batch_end_idx})...",
                            total=len(current_batch_data)
                        )

                        print_message(f"Traitement du lot {i+1}/{num_batches} ({len(current_batch_data)} chunks)...", silent=silent_mode or preview_mode, debug_mode=debug_mode)
                        
                        batch_transcriptions = await process_batch(
                            current_batch_data, client, cfg_api_url, cfg_api_key, cfg_language, cfg_prompt,
                            batch_chunk_task_id, progress, silent_mode or preview_mode, debug_mode, preview_window, file_writer
                        )
                        
                        batch_output_for_silent_mode = []
                        # Le réassemblage dans l'ordre est garanti ici.
                        # `all_transcriptions` est une liste pré-allouée de la taille du nombre total de chunks.
                        # En utilisant `global_chunk_idx`, chaque transcription est placée à sa position
                        # correcte dans la liste, quel que soit l'ordre dans lequel les réponses de l'API arrivent.
                        for original_idx_in_batch, transcription_text in enumerate(batch_transcriptions):
                            global_chunk_idx = batch_start_idx + original_idx_in_batch
                            if transcription_text is not None:
                                all_transcriptions[global_chunk_idx] = transcription_text
                                batch_output_for_silent_mode.append(transcription_text)
                            else:
                                error_msg = f"[TRANSCRIPTION ÉCHOUÉE POUR CHUNK {global_chunk_idx+1}]"
                                all_transcriptions[global_chunk_idx] = error_msg
                                batch_output_for_silent_mode.append(error_msg)
                            progress.update(overall_task_id, advance=1) # Mise à jour de la progression globale des chunks
                            
                        if silent_mode and not preview_mode:
                            batch_text = " ".join(filter(None, batch_output_for_silent_mode))
                            if batch_text.strip():
                                console.print(batch_text.strip())
                        
                        progress.remove_task(batch_chunk_task_id) # Supprimer la barre de progression du lot une fois terminée
                        print_message(f"Lot {i+1}/{num_batches} terminé.", style="success", silent=silent_mode or preview_mode, debug_mode=debug_mode)

                        # Rework par lot si demandé
                        if cfg_rework:
                            batch_text_to_rework = " ".join(filter(None, batch_output_for_silent_mode))
                            if batch_text_to_rework.strip():
                                # Créer une tâche temporaire pour le raffinement du lot
                                rework_task_id = progress.add_task(f"[yellow]Raffinage du lot {i+1}/{num_batches}...", total=1)
                                
                                # Construire l'URL de chat correctement à chaque fois
                                base_api_url = cfg_api_url.split('/v1/')[0]
                                chat_api_url = f"{base_api_url}/v1/chat/completions"
                                
                                reworked_text = await rework_transcription(
                                    client, chat_api_url, cfg_api_key, batch_text_to_rework, cfg_rework_prompt,
                                    cfg_rework_model, silent=silent_mode, debug_mode=debug_mode,
                                    context_sentence=last_reworked_sentence if cfg_rework_follow else None
                                )
                                
                                if reworked_text:
                                    # Mettre à jour la dernière phrase pour le prochain lot
                                    if cfg_rework_follow:
                                        # Prend les 150 derniers caractères comme approximation d'une phrase
                                        last_reworked_sentence = reworked_text.strip()[-150:]
                                    
                                    # Utiliser le gestionnaire de fichier pour le rework
                                    rework_writer.write_text(reworked_text)
                                    print_message(f"Lot {i+1}/{num_batches} raffiné et ajouté au fichier de sortie.", style="success", silent=silent_mode, debug_mode=debug_mode)
                                
                                progress.update(rework_task_id, advance=1) # Marquer la tâche de raffinement comme terminée
                                progress.remove_task(rework_task_id) # Supprimer la barre de raffinement

            if os.name == 'nt':
                asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
            
            # Déterminer le nom du fichier de sortie pour le rework
            rework_output_filename = None
            if cfg_rework:
                if args.rework_output_file:
                    rework_output_filename = args.rework_output_file
                elif output_file:
                    p = Path(output_file)
                    rework_output_filename = str(p.with_name(f"rework_{p.name}"))
                else:
                    p = Path(audio_file_path)
                    rework_output_filename = f"rework_{p.stem}.txt"

            with StreamingFileWriter(rework_output_filename, cfg_output_directory) as rework_writer:
                if rework_writer.file_path:
                    print_message(f"Écriture du rework en temps réel activée vers: {rework_writer.file_path}", style="info", silent=silent_mode, debug_mode=debug_mode)
                
                # Lancer le traitement
                asyncio.run(run_batches_async())

    # Finalisation
    if preview_window:
        preview_window.set_status("Transcription terminée!", "green")

    final_verbatim = " ".join(filter(None, all_transcriptions))
    if final_verbatim:
        final_verbatim = final_verbatim.strip()
    else:
        final_verbatim = ""
    
    if not silent_mode:
        console.rule("[bold green]Transcription Finale Complète")
        console.print(final_verbatim)
        console.rule()


    # Sauvegarder la transcription finale si pas d'écriture en streaming
    if output_file and not file_writer.file_path:
        output_path = Path(output_file)
        if not output_path.is_absolute():
            output_dir_path = Path(cfg_output_directory)
            output_dir_path.mkdir(parents=True, exist_ok=True)
            output_path = output_dir_path / Path(os.path.basename(output_file))
        else:
            output_path.parent.mkdir(parents=True, exist_ok=True)
        
        try:
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(final_verbatim)
            print_message(f"Transcription finale sauvegardée dans : {output_path}", style="success", silent=silent_mode, debug_mode=debug_mode)
        except IOError as e:
            print_message(f"Erreur lors de la sauvegarde de la transcription dans '{output_path}': {e}", style="error", silent=silent_mode, debug_mode=debug_mode)
    elif not silent_mode and not file_writer.file_path and not cfg_rework:
        # N'afficher ce message que si on ne fait pas de rework (car le rework a déjà son propre fichier)
        print_message("Aucun fichier de sortie spécifié. La transcription finale est affichée ci-dessus.", silent=silent_mode, debug_mode=debug_mode)

    end_time = time.time()
    total_duration_sec = end_time - start_time
    print_message(f"Traitement complet terminé en {total_duration_sec:.2f} secondes.", style="info", silent=silent_mode, debug_mode=debug_mode)

if __name__ == '__main__':
    # Création du parser avec argparse
    parser = argparse.ArgumentParser(
        description=f"{TermColors.HEADER}{TermColors.BOLD}🎙️ Transkryptor Python CLI - Transcription Audio Avancée 🎙️{TermColors.ENDC}\n{(__doc__ or '').strip()}",
        formatter_class=ColoredHelpFormatter,
        epilog=f"""{TermColors.OKGREEN}{TermColors.BOLD}Exemples d'utilisation:{TermColors.ENDC}
  {TermColors.OKCYAN}python transkryptor.py chemin/vers/audio.mp3{TermColors.ENDC}
  {TermColors.OKCYAN}python transkryptor.py mon_audio.wav -o transcription.txt --debug{TermColors.ENDC}
  {TermColors.OKCYAN}python transkryptor.py interview.m4a -l en -p "Interview AI"{TermColors.ENDC}
  {TermColors.OKCYAN}python transkryptor.py podcast.ogg --silent > podcast.txt{TermColors.ENDC}
  {TermColors.OKCYAN}python transkryptor.py conference.mp3 --preview -o transcript.txt{TermColors.ENDC}"""
    )

    parser.add_argument('audio_file_path', metavar="AUDIO_FILE_PATH", type=str, help="Chemin vers le fichier audio à transcrire.")
    parser.add_argument('-o', '--output-file', type=str, help="Fichier pour sauvegarder la transcription finale.")
    parser.add_argument('-c', '--config-file', type=str, default=DEFAULT_CONFIG_FILENAME, help=f"Chemin vers le fichier de configuration JSON (défaut: {DEFAULT_CONFIG_FILENAME} dans le répertoire du script ou CWD).")
    parser.add_argument('--api-url', type=str, help="URL de l'API de transcription LLMaaS.")
    parser.add_argument('--api-key', type=str, help="Clé API pour LLMaaS.")
    parser.add_argument('-l', '--language', type=str, help="Code langue de l'audio (ex: fr, en).")
    parser.add_argument('-p', '--prompt', type=str, help="Prompt pour guider la transcription.")
    parser.add_argument('--chunk-duration', type=int, help="Durée de chaque morceau en millisecondes.")
    parser.add_argument('--chunk-overlap', type=int, help="Chevauchement entre les morceaux en millisecondes.")
    parser.add_argument('--batch-size', type=int, help="Nombre de morceaux à traiter en parallèle par lot.")
    parser.add_argument('--sample-rate', type=int, help="Fréquence d'échantillonnage en Hz (ex: 16000, 22050, 44100).")
    parser.add_argument('--output-dir', type=str, help="Répertoire pour sauvegarder les transcriptions (si --output-file n'est pas un chemin absolu).")
    parser.add_argument('--preview', action='store_true', help="Ouvrir une fenêtre de prévisualisation pour voir la transcription en temps réel.")
    parser.add_argument('--debug', action='store_true', help="Activer le mode de débogage verbeux.")
    parser.add_argument('--silent', action='store_true', help="Mode silencieux: affiche la transcription des lots sur stdout.")
    parser.add_argument('--rework', action='store_true', help="Activer le mode de raffinement de la transcription.")
    parser.add_argument('--rework-follow', action='store_true', help="Fournir la fin du lot précédent comme contexte pour le lot suivant.")
    parser.add_argument('--rework-prompt', type=str, default=SYSTEM_PROMPT, help="Prompt pour le raffinement de la transcription.")
    parser.add_argument('--rework-model', type=str, default="qwen3:14b", help="Modèle à utiliser pour le raffinement.")
    parser.add_argument('--rework-output-file', type=str, help="Fichier pour sauvegarder la transcription raffinée.")
    
    parsed_args = parser.parse_args()
    
    # Vérifier si le fichier audio existe après le parsing des arguments
    if not os.path.exists(parsed_args.audio_file_path):
        try:
            print_message(f"Erreur: Le fichier audio spécifié '{parsed_args.audio_file_path}' n'existe pas.", style="error")
        except NameError:
            print(f"ERREUR: Le fichier audio spécifié '{parsed_args.audio_file_path}' n'existe pas.")
        sys.exit(1)

    run_transcription_pipeline(parsed_args)
