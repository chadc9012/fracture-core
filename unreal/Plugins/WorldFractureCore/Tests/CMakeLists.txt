# Builds World Fracture's engine-free rules (Source/WorldFractureCore/*/Core) outside Unreal and runs their golden
# tests, which replay states recorded from the web build's TypeScript engine.
#
#   cmake -S . -B build -G Ninja && cmake --build build && ctest --test-dir build --output-on-failure
cmake_minimum_required(VERSION 3.20)
project(WorldFractureCoreTests CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(CORE_DIR ${CMAKE_CURRENT_SOURCE_DIR}/../Source/WorldFractureCore)
file(GLOB CORE_SOURCES CONFIGURE_DEPENDS ${CORE_DIR}/Private/Core/*.cpp)

add_library(wfcore STATIC ${CORE_SOURCES})
target_include_directories(wfcore PUBLIC ${CORE_DIR}/Public)
# Unreal builds with warnings such as shadowing as errors; hold the shared core to the same bar here.
if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
	target_compile_options(wfcore PRIVATE -Wall -Wextra -Wshadow -Wconversion -Wno-sign-conversion -Werror)
endif()

enable_testing()

# One executable per *Test.cpp; each takes its golden file (<name>_golden.txt) as its argument.
file(GLOB TEST_SOURCES CONFIGURE_DEPENDS ${CMAKE_CURRENT_SOURCE_DIR}/*Test.cpp)
foreach(TEST_SOURCE ${TEST_SOURCES})
	get_filename_component(TEST_NAME ${TEST_SOURCE} NAME_WE)
	add_executable(${TEST_NAME} ${TEST_SOURCE})
	target_link_libraries(${TEST_NAME} PRIVATE wfcore)
	string(REGEX REPLACE "CoreTest$" "" GOLDEN_STEM ${TEST_NAME})
	string(TOLOWER ${GOLDEN_STEM} GOLDEN_STEM)
	# goldens are generated, not committed (they run to ~60 MB): record them with `node unreal/tools/gen-goldens.mjs` from the repo root
	if(NOT EXISTS ${CMAKE_CURRENT_SOURCE_DIR}/${GOLDEN_STEM}_golden.txt)
		message(FATAL_ERROR "${GOLDEN_STEM}_golden.txt is missing: run `node unreal/tools/gen-goldens.mjs` from the repo root first")
	endif()
	add_test(NAME ${TEST_NAME} COMMAND ${TEST_NAME} ${CMAKE_CURRENT_SOURCE_DIR}/${GOLDEN_STEM}_golden.txt)
endforeach()
