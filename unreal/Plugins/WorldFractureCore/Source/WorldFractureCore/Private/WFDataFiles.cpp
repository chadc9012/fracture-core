#include "WFDataFiles.h"

#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"

namespace WFData
{
	FString TablePath(const FString& Table)
	{
		return FPaths::Combine(FPaths::ProjectDir(), TEXT("DataTables"), Table + TEXT(".json"));
	}

	bool LoadRows(const FString& Table, TArray<TSharedPtr<FJsonObject>>& OutRows, FString& OutError)
	{
		OutRows.Reset();
		const FString Path = TablePath(Table);
		FString Text;
		if (!FFileHelper::LoadFileToString(Text, *Path))
		{
			OutError = FString::Printf(TEXT("missing %s"), *Path);
			return false;
		}
		TArray<TSharedPtr<FJsonValue>> Values;
		if (!FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Text), Values))
		{
			OutError = FString::Printf(TEXT("%s is not a JSON array"), *Path);
			return false;
		}
		for (const TSharedPtr<FJsonValue>& Value : Values)
		{
			const TSharedPtr<FJsonObject> Row = Value.IsValid() ? Value->AsObject() : nullptr;
			if (!Row.IsValid())
			{
				OutError = FString::Printf(TEXT("%s has a row that is not an object"), *Path);
				return false;
			}
			OutRows.Add(Row);
		}
		return true;
	}

	FString Str(const TSharedPtr<FJsonObject>& Row, const TCHAR* Field)
	{
		FString Value;
		Row->TryGetStringField(Field, Value);
		return Value;
	}

	double Num(const TSharedPtr<FJsonObject>& Row, const TCHAR* Field, double Fallback)
	{
		double Value = Fallback;
		Row->TryGetNumberField(Field, Value);
		return Value;
	}

	std::string ToStd(const FString& S) { return std::string(TCHAR_TO_UTF8(*S)); }
	FString ToF(const std::string& S) { return FString(UTF8_TO_TCHAR(S.c_str())); }
}
