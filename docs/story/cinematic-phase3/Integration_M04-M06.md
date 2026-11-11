# Godot 4 integration notes

1. Copy `cinematic_scenes_all_M01-M06.json` into `res://data/cinematic_scenes.json` in your editable Godot project. It preserves all M01–M03 scenes and appends M04–M06.
2. Reuse the included `godot/DialogueCinematicPlayer.tscn` and `.gd` controller; its `play_scene("04A")` API is unchanged.
3. Trigger 04A→04B→04C during the first Operator encounter; 05A→05B→either 05C_COOPERATE **or** 05C_INDEPENDENT; 06A→06B→06C in Verdant Forest.
4. **Do not auto-play both M05 branches.** Use the existing game choice state to select one and persist the choice.
5. Connect `line_started` to camera/animation cues; `scene_finished` to game quest transitions. Camera fields are directing notes, not executed camera paths.
6. Record and import voice files. Empty `audio_file` means subtitles only. Use the CSV as the recording queue.
7. Check subtitle layout, scene triggers, voice playback and performance on Galaxy S22 Ultra.

No original game files or APK have been changed. No voice audio, rendered cutscenes, or playable Godot validation was produced in this phase.
