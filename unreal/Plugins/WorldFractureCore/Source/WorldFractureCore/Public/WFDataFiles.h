#pragma once

#include "CoreMinimal.h"
#include "Dom/JsonObject.h"

#include <string>
#include <utility>

/**
 * Reads the exported tables straight from <Project>/DataTables/<Table>.json (staged with packaged builds; see
 * DefaultGame.ini), so the game runs before anyone imports them as DataTable assets. Same files, same rows.
 */
namespace WFData
{
	WORLDFRACTURECORE_API FString TablePath(const FString& Table);
	/** All rows of a table. False with a reason if the file is missing or not a JSON array of objects. */
	WORLDFRACTURECORE_API bool LoadRows(const FString& Table, TArray<TSharedPtr<FJsonObject>>& OutRows, FString& OutError);

	WORLDFRACTURECORE_API FString Str(const TSharedPtr<FJsonObject>& Row, const TCHAR* Field);
	WORLDFRACTURECORE_API double Num(const TSharedPtr<FJsonObject>& Row, const TCHAR* Field, double Fallback = 0.0);
	WORLDFRACTURECORE_API std::string ToStd(const FString& S);
	WORLDFRACTURECORE_API FString ToF(const std::string& S);
	/** any engine string with operator* giving TCHARs (UE 5.8 JSON object keys are UE::TSharedString, not FString) */
	template <typename T, typename = decltype(FString(*std::declval<const T&>()))>
	std::string ToStd(const T& S) { return ToStd(FString(*S)); }
}
