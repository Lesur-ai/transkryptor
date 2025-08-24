#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Utilitaires pour l'Interface en Ligne de Commande (CLI) de Transkryptor.

Ce module fournit des fonctions pour un affichage amélioré dans la console,
en utilisant la bibliothèque `rich` pour les couleurs, le formatage
et les barres de progression.
"""

from rich.console import Console
from rich.theme import Theme
from rich.progress import Progress, SpinnerColumn, BarColumn, TextColumn, TimeRemainingColumn, TimeElapsedColumn
from rich.panel import Panel
from rich.text import Text
from typing import Union, Dict # Déplacer l'import ici

# Initialisation de la console Rich
# Thème personnalisé pour différents types de messages
custom_theme = Theme({
    "info": "cyan",
    "success": "green",
    "warning": "yellow",
    "error": "bold red",
    "debug": "dim blue",
    "progress.description": "white",
    "progress.percentage": "magenta",
    "progress.bar": "green",
    "repr.path": "dim blue",
    "repr.filename": "blue",
})
console = Console(theme=custom_theme)

# --- Fonctions d'affichage de base ---

def print_message(message: str, style: str = "info", silent: bool = False, debug_mode: bool = False):
    """
    Affiche un message formaté dans la console.
    En mode debug, tous les messages sont affichés, même si silent=True pour les messages non-debug.
    En mode silent, seuls les messages de debug (si debug_mode=True) ou les erreurs sont affichés.
    """
    if debug_mode and style == "debug": # Toujours afficher les messages de debug si debug_mode est activé
        console.print(f"[DEBUG] {message}", style="debug")
    elif not silent or style == "error": # Afficher si non silencieux, ou si c'est une erreur
        if style == "info":
            console.print(f"[INFO] {message}", style=style)
        elif style == "success":
            console.print(f"[SUCCESS] {message}", style=style)
        elif style == "warning":
            console.print(f"[WARNING] {message}", style=style)
        elif style == "error":
            console.print(f"[ERROR] {message}", style=style)
        else: # Style par défaut ou inconnu
            console.print(message)

def print_panel(title: str, content: str, style: str = "info", silent: bool = False):
    """Affiche un contenu dans un panneau stylisé."""
    if not silent:
        border_style = style if style in ["info", "success", "warning", "error", "debug"] else "blue"
        console.print(Panel(Text(content, style=style), title=title, border_style=border_style, expand=False))

def print_debug_data(title: str, data_content: Union[str, Dict], silent: bool = False, debug_mode: bool = False):
    """Affiche des données de débogage dans un panneau si le mode debug est actif."""
    if debug_mode and not silent:
        # Import json ici car il pourrait ne pas être importé globalement si cli_ui est utilisé minimalement
        import json
        # Union et Dict sont maintenant importés au niveau du module
        
        content_str = json.dumps(data_content, indent=2, ensure_ascii=False) if isinstance(data_content, dict) else str(data_content)
        console.print(Panel(Text(content_str), title=f"[DEBUG] {title}", border_style="debug", expand=False)) # Utiliser le style "debug" du thème

# --- Gestion de la progression ---

# Colonnes personnalisées pour la barre de progression
# Spinner, description, barre, pourcentage, temps restant, temps écoulé
progress_columns = [
    SpinnerColumn(spinner_name="dots"),
    TextColumn("[progress.description]{task.description}", table_column=None),
    BarColumn(),
    TextColumn("[progress.percentage]{task.percentage:>3.1f}%", table_column=None),
    TextColumn("•", table_column=None),
    TimeRemainingColumn(),
    TextColumn("•", table_column=None),
    TimeElapsedColumn(),
]

def get_progress_bar(*args, **kwargs):
    """Retourne une instance de la barre de progression Rich."""
    # Passer les colonnes personnalisées ici
    return Progress(*progress_columns, console=console, **kwargs)

if __name__ == '__main__':
    # Exemples d'utilisation (pour test)
    print_message("Ceci est un message d'information.", style="info")
    print_message("Opération réussie !", style="success")
    print_message("Attention, quelque chose d'inhabituel.", style="warning")
    print_message("Une erreur critique est survenue.", style="error")
    print_message("Message de débogage (normalement caché).", style="debug", debug_mode=False) # Ne s'affiche pas
    print_message("Message de débogage (visible).", style="debug", debug_mode=True)

    print_message("Message d'info en mode silent (caché).", style="info", silent=True)
    print_message("Message d'erreur en mode silent (visible).", style="error", silent=True)
    print_message("Message de debug en mode silent (visible si debug_mode).", style="debug", silent=True, debug_mode=True)


    print_panel("Titre du Panneau Info", "Contenu informatif ici.", style="info")
    print_panel("Titre du Panneau Succès", "Le processus s'est terminé avec succès.", style="success")

    print_debug_data("Données de la Requête", "{'param': 'valeur', 'autre_param': 123}", debug_mode=True)
    print_debug_data("Données de la Réponse", "{'result': 'ok', 'data': [1, 2, 3]}", debug_mode=True, silent=False)
    print_debug_data("Ceci ne s'affiche pas", "Contenu", debug_mode=False)

    console.print("Test de la console Rich avec [bold red]texte en gras rouge[/] et [cyan underline]cyan souligné[/].")

    # Exemple de barre de progression
    import time
    with get_progress_bar() as progress:
        task1 = progress.add_task("[cyan]Traitement global...", total=100)
        task2 = progress.add_task("[magenta]Lot 1/2...", total=50)

        while not progress.finished:
            progress.update(task1, advance=0.5)
            progress.update(task2, advance=0.25)
            time.sleep(0.02)
            if progress.tasks[task2].completed >= 50 and len(progress.tasks) < 3 :
                 progress.remove_task(task2)
                 task3 = progress.add_task("[magenta]Lot 2/2...", total=50)
                 task2 = task3 # pour que la condition de sortie fonctionne

    print_message("Barre de progression terminée.", style="success")
