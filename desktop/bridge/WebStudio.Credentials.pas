unit WebStudio.Credentials;

interface

uses System.SysUtils;

function ReadCredential(const Target: string): string;
procedure WriteCredential(const Target, Secret: string);
procedure DeleteCredential(const Target: string);

implementation

uses Winapi.Windows;

const
  WebStudioCredentialType = 1;
  WebStudioCredentialPersistLocalMachine = 2;
  WebStudioCredentialNotFound = 1168;
  MaximumCredentialBytes = 2560;

type
  PWebStudioCredential = ^TWebStudioCredential;
  TWebStudioCredential = record
    Flags: DWORD;
    CredentialType: DWORD;
    TargetName: PWideChar;
    Comment: PWideChar;
    LastWritten: TFileTime;
    CredentialBlobSize: DWORD;
    CredentialBlob: PByte;
    Persist: DWORD;
    AttributeCount: DWORD;
    Attributes: Pointer;
    TargetAlias: PWideChar;
    UserName: PWideChar;
  end;

function WinCredRead(TargetName: PWideChar; CredentialType, Flags: DWORD;
  var Credential: PWebStudioCredential): BOOL; stdcall; external 'advapi32.dll' name 'CredReadW';
function WinCredWrite(Credential: PWebStudioCredential; Flags: DWORD): BOOL; stdcall; external 'advapi32.dll' name 'CredWriteW';
function WinCredDelete(TargetName: PWideChar; CredentialType, Flags: DWORD): BOOL; stdcall; external 'advapi32.dll' name 'CredDeleteW';
procedure WinCredFree(Buffer: Pointer); stdcall; external 'advapi32.dll' name 'CredFree';

function ReadCredential(const Target: string): string;
var Credential: PWebStudioCredential; Bytes: TBytes; ErrorCode: DWORD;
begin
  Result := '';
  Credential := nil;
  if not WinCredRead(PWideChar(Target), WebStudioCredentialType, 0, Credential) then begin
    ErrorCode := GetLastError;
    if ErrorCode = WebStudioCredentialNotFound then Exit;
    raise EInOutError.CreateFmt('Windows credential read failed (%d).', [ErrorCode]);
  end;
  try
    if Credential.CredentialBlobSize > MaximumCredentialBytes then
      raise EInOutError.Create('The saved credential is too large.');
    SetLength(Bytes, Credential.CredentialBlobSize);
    if Length(Bytes) > 0 then Move(Credential.CredentialBlob^, Bytes[0], Length(Bytes));
    Result := TEncoding.UTF8.GetString(Bytes);
  finally
    if Length(Bytes) > 0 then FillChar(Bytes[0], Length(Bytes), 0);
    WinCredFree(Credential);
  end;
end;

procedure WriteCredential(const Target, Secret: string);
var Credential: TWebStudioCredential; Bytes: TBytes; UserName: string;
begin
  Bytes := TEncoding.UTF8.GetBytes(Secret);
  try
    if (Trim(Secret) = '') or (Length(Bytes) > MaximumCredentialBytes) then
      raise EArgumentException.Create('Enter a nonempty API key of at most 2560 UTF-8 bytes.');
    FillChar(Credential, SizeOf(Credential), 0);
    UserName := 'Delphi Web Studio Pro';
    Credential.CredentialType := WebStudioCredentialType;
    Credential.TargetName := PWideChar(Target);
    Credential.CredentialBlobSize := Length(Bytes);
    Credential.CredentialBlob := @Bytes[0];
    Credential.Persist := WebStudioCredentialPersistLocalMachine;
    Credential.UserName := PWideChar(UserName);
    if not WinCredWrite(@Credential, 0) then
      raise EInOutError.CreateFmt('Windows credential save failed (%d).', [GetLastError]);
  finally
    if Length(Bytes) > 0 then FillChar(Bytes[0], Length(Bytes), 0);
  end;
end;

procedure DeleteCredential(const Target: string);
var ErrorCode: DWORD;
begin
  if not WinCredDelete(PWideChar(Target), WebStudioCredentialType, 0) then begin
    ErrorCode := GetLastError;
    if ErrorCode <> WebStudioCredentialNotFound then
      raise EInOutError.CreateFmt('Windows credential removal failed (%d).', [ErrorCode]);
  end;
end;

end.
