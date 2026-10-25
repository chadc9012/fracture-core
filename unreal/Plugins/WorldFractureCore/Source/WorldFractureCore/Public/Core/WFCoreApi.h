// World Fracture — export macro for the engine-free core.
// Inside Unreal, UBT defines WORLDFRACTURECORE_API (dllexport in the plugin, dllimport in the game module), so the
// game module can call these functions in modular (editor) builds. The standalone tests define it as nothing.
#pragma once

#ifndef WORLDFRACTURECORE_API
#define WORLDFRACTURECORE_API
#endif
