#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Transkryptor Rework CLI - Raffinement de Texte Avancé.

Ce script prend un fichier texte en entrée, le découpe en morceaux basés sur le nombre de tokens,
puis applique un processus de raffinement (rework) à chaque morceau via l'API LLMaaS.
Il gère le parallélisme des requêtes par lots et offre une interface utilisateur soignée
avec des barres de progression et une prévisualisation en temps réel.
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
from api_utils import rework_transcription
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

# Dépendances pour le découpage de texte par tokens
try:
    import tiktoken
    from langchain_text_splitters import RecursiveCharacterTextSplitter
except ImportError:
    print(f"{TermColors.FAIL}Erreur: Les dépendances 'tiktoken' et 'langchain-text-splitters' sont nécessaires pour ce script.")
    print(f"Veuillez les installer en exécutant: {TermColors.OKCYAN}pip install tiktoken langchain-text-splitters{TermColors.ENDC}")
    sys.exit(1)

# --- Configuration par défaut ---
DEFAULT_CONFIG_FILENAME = "config.json"
DEFAULT_TOKEN_CHUNK_SIZE = 1024    # Taille de chunk par défaut en tokens
DEFAULT_TOKEN_CHUNK_OVERLAP = 128  # Chevauchement par défaut en tokens
DEFAULT_BATCH_SIZE = 1             # Taille de lot par défaut
DEFAULT_OUTPUT_DIR = "./transkryptor_outputs"

class TerminalPreview:
    """Prévisualisation du texte raffiné en temps réel dans le terminal."""
    
    def __init__(self, input_filename: str):
        self.input_filename = os.path.basename(input_filename)
        self.full_reworked_text = ""  # Texte complet raffiné
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
                Align.center(f"✨ [bold magenta]Transkryptor Rework - Raffinement en Temps Réel[/bold magenta]\n[dim]{self.input_filename}[/dim]"),
                title="📄 Fichier Source"
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
        if not self.full_reworked_text.strip():
            return "[dim]Raffinement en cours...[/dim]"
        
        max_chars = 3000  # Augmenté pour plus de contexte
        
        if len(self.full_reworked_text) <= max_chars:
            return self.full_reworked_text
        else:
            truncated = self.full_reworked_text[-max_chars:]
            space_index = truncated.find(' ')
            if space_index > 0 and space_index < 100:
                truncated = truncated[space_index+1:]
            
            return "..." + truncated
    
    def _update_content_panel(self):
        """Met à jour le panneau de contenu avec le texte raffiné."""
        display_text = self._get_display_text()
        
        self.layout["content"].update(
            Panel(
                Text(display_text),
                title=f"📝 Texte Raffiné ({len(self.full_reworked_text)} caractères)",
                border_style="magenta"
            )
        )
        
        if self.live_display:
            try:
                self.live_display.refresh()
            except:
                pass
    
    def set_total_chunks(self, total: int):
        """Définit le nombre total de chunks à traiter."""
        self.total_chunks = total
        self._update_progress_panel()
    
    def add_reworked_text(self, chunk_index: int, text: str):
        """Ajoute du texte raffiné avec accumulation et scroll automatique."""
        if text and text.strip():
            if self.full_reworked_text:
                self.full_reworked_text += " "
            
            self.full_reworked_text += text.strip()
            
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
                    current_time = time.time()
                    if current_time - self.last_update_time > 1.0:
                        self._update_progress_panel()
                        self.last_update_time = current_time
                    time.sleep(0.2)
                except:
                    break
        
        update_thread = threading.Thread(target=update_display, daemon=True)
        update_thread.start()
        
        try:
            self.live_display = Live(self.layout, refresh_per_second=4, screen=True)
            self.live_display.start()
        except Exception as e:
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
        """Retourne le texte complet du raffinement."""
        return self.full_reworked_text

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
            if self.file_handle.tell() > 0:
                self.file_handle.write(" ")
            self.file_handle.write(text.strip())
            self.file_handle.flush()
    
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
        "default_language": "fr", # Non utilisé directement par rework-only, mais peut être dans config.json
        "default_prompt": "",     # Non utilisé directement par rework-only
        "chunk_duration_ms": None, # Non utilisé par rework-only
        "chunk_overlap_ms": None,  # Non utilisé par rework-only
        "batch_size": DEFAULT_BATCH_SIZE,
        "sample_rate_hz": None,    # Non utilisé par rework-only
        "output_directory": DEFAULT_OUTPUT_DIR,
        "rework_enabled": True,    # Toujours activé pour rework-only
        "rework_model": "qwen3:14b",
        "rework_prompt": SYSTEM_PROMPT # Utilise le prompt par défaut du module prompts
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
            config["batch_size"] = file_config.get("batch_size", config["batch_size"])
            config["output_directory"] = file_config.get("output_directory", config["output_directory"])
            
            # Charger les options de rework spécifiques
            config["rework_model"] = file_config.get("rework_model", config["rework_model"])
            config["rework_prompt"] = file_config.get("rework_prompt", config["rework_prompt"])

            print_message(f"Configuration chargée depuis '{actual_config_path}'.", silent=silent, debug_mode=debug_mode)
        except json.JSONDecodeError:
            print_message(f"Erreur de décodage JSON dans '{actual_config_path}'. Utilisation des valeurs par défaut/CLI.", style="error", silent=silent, debug_mode=debug_mode)
        except Exception as e:
            print_message(f"Erreur lors du chargement de '{actual_config_path}': {e}. Utilisation des valeurs par défaut/CLI.", style="error", silent=silent, debug_mode=debug_mode)
    elif config_path and config_path != DEFAULT_CONFIG_FILENAME :
        print_message(f"Fichier de configuration '{config_path}' non trouvé. Utilisation des valeurs par défaut/CLI.", style="warning", silent=silent, debug_mode=debug_mode)
    
    return config

def get_token_counter(model_name: str):
    """Retourne une fonction de comptage de tokens pour un modèle donné."""
    try:
        # Utilise tiktoken pour les modèles OpenAI-compatibles
        tokenizer = tiktoken.encoding_for_model(model_name)
    except KeyError:
        # Fallback pour les modèles non-OpenAI, ou si le modèle n'est pas trouvé dans tiktoken
        # Cela peut être moins précis mais évite une erreur
        print_message(f"Avertissement: Tokenizer tiktoken non trouvé pour le modèle '{model_name}'. Utilisation d'un tokenizer générique.", style="warning")
        tokenizer = tiktoken.get_encoding("cl100k_base") # Fallback générique

    def token_len(text: str) -> int:
        return len(tokenizer.encode(text))
    return token_len

async def process_rework_batch(
    batch_chunks_text: List[str], 
    http_client: httpx.AsyncClient,
    chat_api_url: str,
    api_key: str,
    rework_prompt: str,
    rework_model: str,
    batch_progress_task_id, 
    progress_bar, 
    silent: bool,
    debug_mode: bool,
    preview_window: Optional[TerminalPreview] = None,
    file_writer: Optional[StreamingFileWriter] = None
) -> List[Optional[str]]:
    """Traite un lot de chunks de texte en parallèle pour le raffinement."""
    tasks = []
    
    for chunk_text in batch_chunks_text:
        task = rework_transcription(
            client=http_client, chat_api_url=chat_api_url, api_key=api_key,
            transcription_text=chunk_text, rework_prompt=rework_prompt,
            rework_model=rework_model, silent=silent, debug_mode=debug_mode
        )
        tasks.append(task)

    batch_results = await asyncio.gather(*tasks, return_exceptions=True)
    
    processed_reworks = []
    for i, result in enumerate(batch_results):
        if isinstance(result, Exception):
            print_message(f"Erreur lors du raffinement du chunk {i + 1} du lot: {result}", style="error", silent=silent, debug_mode=debug_mode)
            processed_reworks.append(None)
        elif result is None:
            processed_reworks.append(None)
        else:
            processed_reworks.append(result)
            
            # Écriture au fur et à mesure dans le fichier
            if file_writer and isinstance(result, str) and result.strip():
                file_writer.write_text(result)
            
            # Mise à jour de la fenêtre de prévisualisation
            if preview_window and isinstance(result, str) and result.strip():
                preview_window.add_reworked_text(i, result)
        
        # Mise à jour de la progression dans la fenêtre de prévisualisation
        if preview_window:
            preview_window.increment_progress()
            
    # Forcer le rafraîchissement de la barre de progression du lot
    if not silent and not debug_mode:
        progress_bar.refresh()
            
    return processed_reworks

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

def run_rework_pipeline(args):
    """Exécute le pipeline de raffinement principal."""
    start_time = time.time()
    
    if args.preview and args.debug:
        print_message("Erreur: Les modes --preview et --debug sont incompatibles.", style="error")
        print_message("Le mode preview utilise l'affichage plein écran qui interfère avec les logs de debug.", style="error")
        print_message("Utilisez soit --preview soit --debug, mais pas les deux en même temps.", style="error")
        return
    
    script_dir = os.path.dirname(__file__)
    default_config_path_in_script_dir = os.path.join(script_dir, DEFAULT_CONFIG_FILENAME)

    cfg_input_path = args.config_file
    if args.config_file == DEFAULT_CONFIG_FILENAME and not os.path.exists(args.config_file):
        if os.path.exists(default_config_path_in_script_dir):
            cfg_input_path = default_config_path_in_script_dir

    cfg = load_configuration(cfg_input_path, args.silent, args.debug)

    cfg_api_url = args.api_url if args.api_url is not None else cfg["api_url"]
    cfg_api_key = args.api_key if args.api_key is not None else cfg["api_key"]
    cfg_token_chunk_size = args.token_chunk_size if args.token_chunk_size is not None else DEFAULT_TOKEN_CHUNK_SIZE
    cfg_token_chunk_overlap = args.token_chunk_overlap if args.token_chunk_overlap is not None else DEFAULT_TOKEN_CHUNK_OVERLAP
    cfg_batch_size = args.batch_size if args.batch_size is not None else cfg["batch_size"]
    cfg_output_directory = args.output_dir if args.output_dir is not None else cfg["output_directory"]
    
    # Pour le prompt et le modèle, on établit une priorité : CLI > Fichier config > Défaut
    if args.rework_prompt != parser.get_default('rework_prompt'):
        cfg_rework_prompt = args.rework_prompt
    elif cfg.get("rework_prompt"):
        cfg_rework_prompt = cfg["rework_prompt"]
    else:
        cfg_rework_prompt = parser.get_default('rework_prompt')

    if args.rework_model != parser.get_default('rework_model'):
        cfg_rework_model = args.rework_model
    elif cfg.get("rework_model"):
        cfg_rework_model = cfg["rework_model"]
    else:
        cfg_rework_model = parser.get_default('rework_model')

    input_file_path = args.input_file_path
    output_file = args.output_file
    
    if output_file is None:
        p = Path(input_file_path)
        output_file = f"reworked_{p.stem}.txt"
        print_message(f"Aucun fichier de sortie spécifié. Le texte raffiné sera sauvegardé dans : {output_file}", style="info")

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
            "Input File Path": input_file_path,
            "Output File": output_file or "Non spécifié (stdout ou auto-généré)",
            "API URL": cfg_api_url, "API Key": f"{cfg_api_key[:5]}..." if cfg_api_key else "Non fournie",
            "Token Chunk Size": cfg_token_chunk_size, "Token Chunk Overlap": cfg_token_chunk_overlap,
            "Batch Size": cfg_batch_size, "Output Directory": cfg_output_directory,
            "Rework Prompt": cfg_rework_prompt, "Rework Model": cfg_rework_model,
            "Debug Mode": debug_mode, "Silent Mode": silent_mode, "Preview Mode": preview_mode
        }
        print_debug_data("Options Résolues pour le Raffinement", resolved_options, silent=silent_mode or preview_mode, debug_mode=debug_mode)

    # Charger le texte d'entrée
    try:
        with open(input_file_path, 'r', encoding='utf-8') as f:
            input_text = f.read()
        print_message(f"Fichier d'entrée '{input_file_path}' chargé.", silent=silent_mode or preview_mode, debug_mode=debug_mode)
    except FileNotFoundError:
        print_message(f"Erreur: Le fichier d'entrée '{input_file_path}' n'existe pas.", style="error", silent=silent_mode, debug_mode=debug_mode)
        return
    except Exception as e:
        print_message(f"Erreur lors du chargement du fichier d'entrée '{input_file_path}': {e}", style="error", silent=silent_mode, debug_mode=debug_mode)
        return

    # Découpage du texte en chunks de tokens
    token_len_func = get_token_counter(cfg_rework_model)
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=cfg_token_chunk_size,
        chunk_overlap=cfg_token_chunk_overlap,
        length_function=token_len_func,
        separators=["\n\n", "\n", " ", ""] # Priorise les paragraphes, puis les lignes, puis les mots
    )
    
    text_chunks = text_splitter.split_text(input_text)
    num_chunks = len(text_chunks)
    num_batches = (num_chunks + cfg_batch_size - 1) // cfg_batch_size

    all_reworked_texts: List[str] = [""] * num_chunks
    
    # Initialiser la fenêtre de prévisualisation si demandée
    preview_window = None
    if preview_mode:
        try:
            preview_window = TerminalPreview(input_file_path)
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
            overall_task_id = progress.add_task(f"[cyan]Raffinement global ({num_batches} lots)...", total=num_chunks)
            
            if preview_window:
                preview_window.set_status("Raffinement en cours...", "magenta")
            
            async def run_batches_async():
                async with httpx.AsyncClient() as client:
                    batch_task_id = progress.add_task("[magenta]Traitement des lots...", total=num_batches)
                    for i in range(num_batches):
                        batch_start_idx = i * cfg_batch_size
                        batch_end_idx = min((i + 1) * cfg_batch_size, num_chunks)
                        current_batch_text_chunks = text_chunks[batch_start_idx:batch_end_idx]
                        
                        progress.update(batch_task_id, description=f"[magenta]Lot {i+1}/{num_batches} (chunks {batch_start_idx+1}-{batch_end_idx})...")

                        print_message(f"Traitement du lot {i+1}/{num_batches} ({len(current_batch_text_chunks)} chunks)...", silent=silent_mode or preview_mode, debug_mode=debug_mode)
                        
                        # Construire l'URL de chat correctement
                        base_api_url = cfg_api_url.split('/v1/')[0]
                        chat_api_url = f"{base_api_url}/v1/chat/completions"
                        
                        batch_reworked_texts = await process_rework_batch(
                            current_batch_text_chunks, client, chat_api_url, cfg_api_key, cfg_rework_prompt,
                            cfg_rework_model, batch_task_id, progress, silent_mode or preview_mode, debug_mode, 
                            preview_window, file_writer
                        )
                        
                        batch_output_for_silent_mode = []
                        for original_idx_in_batch, reworked_text in enumerate(batch_reworked_texts):
                            global_chunk_idx = batch_start_idx + original_idx_in_batch
                            if reworked_text is not None:
                                all_reworked_texts[global_chunk_idx] = reworked_text
                                batch_output_for_silent_mode.append(reworked_text)
                            else:
                                error_msg = f"[RAFFINEMENT ÉCHOUÉ POUR CHUNK {global_chunk_idx+1}]"
                                all_reworked_texts[global_chunk_idx] = error_msg
                                batch_output_for_silent_mode.append(error_msg)
                            progress.update(overall_task_id, advance=1) # Mise à jour de la progression globale
                            
                        if silent_mode and not preview_mode:
                            batch_text = " ".join(filter(None, batch_output_for_silent_mode))
                            if batch_text.strip():
                                console.print(batch_text.strip())
                        
                        progress.update(batch_task_id, advance=1) # Avance la barre de progression du lot une fois par lot
                        print_message(f"Lot {i+1}/{num_batches} terminé.", style="success", silent=silent_mode or preview_mode, debug_mode=debug_mode)

            if os.name == 'nt':
                asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
            
            asyncio.run(run_batches_async())

    # Finalisation
    if preview_window:
        preview_window.set_status("Raffinement terminé!", "green")
        preview_window.stop() # Arrêter l'affichage Rich Live

    final_reworked_text = " ".join(filter(None, all_reworked_texts))
    if final_reworked_text:
        final_reworked_text = final_reworked_text.strip()
    else:
        final_reworked_text = ""
    
    if not silent_mode:
        console.rule("[bold green]Texte Raffiné Final Complet")
        console.print(final_reworked_text)
        console.rule()

    end_time = time.time()
    total_duration_sec = end_time - start_time
    print_message(f"Traitement complet terminé en {total_duration_sec:.2f} secondes.", style="info", silent=silent_mode, debug_mode=debug_mode)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description=f"{TermColors.HEADER}{TermColors.BOLD}✨ Transkryptor Rework CLI - Raffinement de Texte Avancé ✨{TermColors.ENDC}\n{(__doc__ or '').strip()}",
        formatter_class=ColoredHelpFormatter,
        epilog=f"""{TermColors.OKGREEN}{TermColors.BOLD}Exemples d'utilisation:{TermColors.ENDC}
  {TermColors.OKCYAN}python rework-only.py chemin/vers/mon_texte.txt -o raffiné.txt{TermColors.ENDC}
  {TermColors.OKCYAN}python rework-only.py rapport.md --token-chunk-size 2048 --batch-size 4 --rework-model "llama3:8b"{TermColors.ENDC}
  {TermColors.OKCYAN}python rework-only.py article.txt --preview{TermColors.ENDC}"""
    )

    parser.add_argument('input_file_path', metavar="INPUT_FILE_PATH", type=str, help="Chemin vers le fichier texte à raffiner.")
    parser.add_argument('-o', '--output-file', type=str, help="Fichier pour sauvegarder le texte raffiné final.")
    parser.add_argument('-c', '--config-file', type=str, default=DEFAULT_CONFIG_FILENAME, help=f"Chemin vers le fichier de configuration JSON (défaut: {DEFAULT_CONFIG_FILENAME} dans le répertoire du script ou CWD).")
    parser.add_argument('--api-url', type=str, help="URL de l'API LLMaaS (pour le raffinement).")
    parser.add_argument('--api-key', type=str, help="Clé API pour LLMaaS.")
    parser.add_argument('--token-chunk-size', type=int, default=DEFAULT_TOKEN_CHUNK_SIZE, help=f"Taille de chaque morceau de texte en tokens (défaut: {DEFAULT_TOKEN_CHUNK_SIZE}).")
    parser.add_argument('--token-chunk-overlap', type=int, default=DEFAULT_TOKEN_CHUNK_OVERLAP, help=f"Chevauchement entre les morceaux de texte en tokens (défaut: {DEFAULT_TOKEN_CHUNK_OVERLAP}).")
    parser.add_argument('--batch-size', type=int, help="Nombre de morceaux à traiter en parallèle par lot.")
    parser.add_argument('--output-dir', type=str, help="Répertoire pour sauvegarder les fichiers de sortie (si --output-file n'est pas un chemin absolu).")
    parser.add_argument('--preview', action='store_true', help="Ouvrir une fenêtre de prévisualisation pour voir le raffinement en temps réel.")
    parser.add_argument('--debug', action='store_true', help="Activer le mode de débogage verbeux.")
    parser.add_argument('--silent', action='store_true', help="Mode silencieux: affiche le texte raffiné des lots sur stdout.")
    parser.add_argument('--rework-prompt', type=str, default=SYSTEM_PROMPT, help="Prompt pour le raffinement du texte.")
    parser.add_argument('--rework-model', type=str, default="qwen3:14b", help="Modèle à utiliser pour le raffinement.")
    
    parsed_args = parser.parse_args()
    
    if not os.path.exists(parsed_args.input_file_path):
        try:
            print_message(f"Erreur: Le fichier d'entrée spécifié '{parsed_args.input_file_path}' n'existe pas.", style="error")
        except NameError:
            print(f"ERREUR: Le fichier d'entrée spécifié '{parsed_args.input_file_path}' n'existe pas.")
        sys.exit(1)

    run_rework_pipeline(parsed_args)
