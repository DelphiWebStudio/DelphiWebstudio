unit WebStudio.LocalWebsite;

interface

uses System.SysUtils, System.Classes, System.Zip, System.Generics.Collections;

type
  TLocalWebsiteRefresh = class
  private
    FFolder, FProjectId, FBackupPath, FManifestChecksum: string;
    FZip: TZipFile;
    FFiles, FPrevious, FOriginal: TDictionary<string, string>;
    FChanged, FRemoved, FWrites: TStringList;
    FHadManifest: Boolean;
    function FilePath(const Relative: string): string;
    procedure ReadPrevious;
  public
    constructor Create(const Folder, ZipPath, ProjectId: string);
    destructor Destroy; override;
    function Summary: string;
    function Details: string;
    function Apply: string;
    class function ValidateFolder(const Folder: string): string; static;
    class function ReadFiles(const Folder, ProjectId: string): TArray<string>; static;
  end;

const LocalWebsiteManifest = '.webstudio-local-site.json';

implementation

uses Winapi.Windows, System.IOUtils, System.JSON, System.Hash,
  System.RegularExpressions, System.DateUtils;

function SafeRelativePath(const Value: string): Boolean;
begin
  Result := (Value <> '') and (Length(Value) <= 240) and
    not Value.StartsWith('/') and not Value.Contains('\') and
    not Value.Contains(':') and not Value.EndsWith('/') and
    not SameText(Value, LocalWebsiteManifest);
  if not Result then Exit;
  for var Segment in Value.Split(['/']) do
    if (Segment = '') or (Segment = '.') or (Segment = '..') or
      Segment.EndsWith('.') or Segment.EndsWith(' ') or
      TRegEx.IsMatch(Segment, '[\x00-\x1f<>"|?*]') or
      TRegEx.IsMatch(Segment, '^(?i:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)') then Exit(False);
end;

procedure CheckNoReparse(const Path: string);
var Current: string; Attributes: Cardinal;
begin
  Current := TPath.GetFullPath(Path);
  while Length(Current) > 3 do begin
    Attributes := GetFileAttributes(PChar(Current));
    if (Attributes <> INVALID_FILE_ATTRIBUTES) and
      ((Attributes and FILE_ATTRIBUTE_REPARSE_POINT) <> 0) then
      raise EArgumentException.Create('Choose a folder without junctions or symbolic links.');
    Current := ExcludeTrailingPathDelimiter(ExtractFileDir(Current));
  end;
end;

function DigestFile(const Path: string): string;
var Stream: TFileStream;
begin
  Stream := TFileStream.Create(Path, fmOpenRead or fmShareDenyWrite);
  try Result := LowerCase(THashSHA2.GetHashString(Stream)) finally Stream.Free end;
end;

function DigestBytes(const Bytes: TBytes): string;
var Hash: THashSHA2;
begin
  Hash := THashSHA2.Create;
  Hash.Update(Bytes);
  Result := LowerCase(Hash.HashAsString);
end;

procedure WriteAtomic(const Path: string; const Bytes: TBytes; const ExpectedOriginal: string = ''; GuardOriginal: Boolean = False);
var Temporary: string; Id: TGUID; Stream: THandleStream; Handle: THandle; Created: Boolean;
  Actual: string;
begin
  CheckNoReparse(Path);
  ForceDirectories(ExtractFileDir(Path));
  if CreateGUID(Id) <> 0 then raise EInvalidOpException.Create('Could not stage website file.');
  Temporary := Path + '.webstudio-' + GUIDToString(Id) + '.tmp';
  Created := False;
  try
    Handle := CreateFile(PChar(Temporary), GENERIC_WRITE, 0, nil, CREATE_NEW, FILE_ATTRIBUTE_NORMAL, 0);
    if Handle = INVALID_HANDLE_VALUE then RaiseLastOSError;
    Created := True;
    try
      Stream := THandleStream.Create(Handle);
      try
        if Length(Bytes) > 0 then Stream.WriteBuffer(Bytes, Length(Bytes));
        if not FlushFileBuffers(Handle) then RaiseLastOSError;
      finally Stream.Free end;
    finally CloseHandle(Handle) end;
    if GuardOriginal then begin
      if TFile.Exists(Path) then Actual := DigestFile(Path) else Actual := '';
      if Actual <> ExpectedOriginal then raise EInvalidOpException.Create('A local file changed while its replacement was being prepared.');
    end;
    if not MoveFileEx(PChar(Temporary), PChar(Path), MOVEFILE_REPLACE_EXISTING or MOVEFILE_WRITE_THROUGH) then RaiseLastOSError;
  finally
    if Created and TFile.Exists(Temporary) then TFile.Delete(Temporary);
  end;
end;

class function TLocalWebsiteRefresh.ValidateFolder(const Folder: string): string;
var Full, ExecutableFolder: string;
begin
  Full := ExcludeTrailingPathDelimiter(TPath.GetFullPath(Folder));
  if (Length(Full) <= 3) or not TDirectory.Exists(Full) then
    raise EArgumentException.Create('Choose an existing dedicated website test folder, not a drive root.');
  if Full.StartsWith('\\') then raise EArgumentException.Create('Choose a local folder on this computer.');
  CheckNoReparse(Full);
  ExecutableFolder := ExcludeTrailingPathDelimiter(ExtractFilePath(ParamStr(0)));
  for var ProtectedFolder in TArray<string>.Create(GetEnvironmentVariable('WINDIR'),
    GetEnvironmentVariable('ProgramFiles'), GetEnvironmentVariable('ProgramFiles(x86)'), GetEnvironmentVariable('ProgramW6432')) do
    if (ProtectedFolder <> '') and (SameText(Full, ExcludeTrailingPathDelimiter(ProtectedFolder)) or
      Full.StartsWith(IncludeTrailingPathDelimiter(ProtectedFolder), True)) then
      raise EArgumentException.Create('Choose a dedicated website test folder outside Windows and application folders.');
  if SameText(Full, ExecutableFolder) or ExecutableFolder.StartsWith(Full + '\', True) or
    Full.StartsWith(ExecutableFolder + '\', True) or
    TDirectory.Exists(TPath.Combine(Full, '.git')) or
    TFile.Exists(TPath.Combine(Full, '.git')) or
    TDirectory.Exists(TPath.Combine(Full, 'node_modules')) or
    TDirectory.Exists(TPath.Combine(Full, 'Projects')) then
    raise EArgumentException.Create('Choose a dedicated website test folder outside application, source and project folders.');
  Result := Full;
end;

function TLocalWebsiteRefresh.FilePath(const Relative: string): string;
begin
  if not SafeRelativePath(Relative) then raise EArgumentException.Create('The website contains an unsafe filename.');
  Result := TPath.GetFullPath(TPath.Combine(FFolder, Relative.Replace('/', '\')));
  if not Result.StartsWith(FFolder + '\', True) then raise EArgumentException.Create('A website file escaped its test folder.');
  CheckNoReparse(Result);
end;

procedure TLocalWebsiteRefresh.ReadPrevious;
var Value: TJSONValue; Manifest: TJSONObject; Files: TJSONArray; Item: TJSONValue;
  Relative, Checksum, Owner: string;
begin
  FHadManifest := TFile.Exists(TPath.Combine(FFolder, LocalWebsiteManifest));
  if not FHadManifest then Exit;
  FManifestChecksum := DigestFile(TPath.Combine(FFolder, LocalWebsiteManifest));
  CheckNoReparse(TPath.Combine(FFolder, LocalWebsiteManifest));
  if TFile.GetSize(TPath.Combine(FFolder, LocalWebsiteManifest)) > 2 * 1024 * 1024 then
    raise EArgumentException.Create('The local website manifest is too large. Choose another folder.');
  Value := TJSONObject.ParseJSONValue(TFile.ReadAllText(TPath.Combine(FFolder, LocalWebsiteManifest), TEncoding.UTF8));
  try
    if not (Value is TJSONObject) then raise EArgumentException.Create('The local website manifest is invalid.');
    Manifest := TJSONObject(Value);
    if (Manifest.GetValue<string>('format', '') <> 'webstudio-local-site') or
      not Manifest.TryGetValue<string>('projectId', Owner) or (Owner <> FProjectId) or
      not Manifest.TryGetValue<TJSONArray>('files', Files) or (Files.Count > 10000) then
      raise EArgumentException.Create('This folder belongs to another website or has an invalid manifest. Choose another folder.');
    for Item in Files do begin
      if not (Item is TJSONObject) or
        not TJSONObject(Item).TryGetValue<string>('path', Relative) or
        not TJSONObject(Item).TryGetValue<string>('sha256', Checksum) or
        not SafeRelativePath(Relative) or not TRegEx.IsMatch(Checksum, '^[a-f0-9]{64}$') or
        FPrevious.ContainsKey(LowerCase(Relative)) then
        raise EArgumentException.Create('The local website manifest contains an invalid file.');
      FPrevious.Add(LowerCase(Relative), Relative);
    end;
  finally Value.Free end;
end;

constructor TLocalWebsiteRefresh.Create(const Folder, ZipPath, ProjectId: string);
var Total: UInt64; Name, Existing: string; Bytes: TBytes; Info: TZipHeader;
begin
  inherited Create;
  FFolder := ValidateFolder(Folder);
  if not TRegEx.IsMatch(ProjectId, '^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$') then
    raise EArgumentException.Create('Open a project before refreshing its local website.');
  FProjectId := ProjectId;
  FFiles := TDictionary<string, string>.Create;
  FPrevious := TDictionary<string, string>.Create;
  FOriginal := TDictionary<string, string>.Create;
  FChanged := TStringList.Create;
  FRemoved := TStringList.Create;
  FWrites := TStringList.Create;
  ReadPrevious;
  FZip := TZipFile.Create;
  FZip.Open(ZipPath, zmRead);
  if (FZip.FileCount > 10000) or (FZip.IndexOf('index.html') < 0) then
    raise EArgumentException.Create('The reviewed package is not a complete website.');
  Total := 0;
  for var Index := 0 to FZip.FileCount - 1 do begin
    Name := FZip.FileName[Index];
    if Name.EndsWith('/') then Continue;
    Info := FZip.FileInfo[Index];
    Inc(Total, Info.UncompressedSize64);
    if Info.IsEncrypted or (Info.UncompressedSize64 > 256 * 1024 * 1024) or (Total > 1024 * 1024 * 1024) or
      not SafeRelativePath(Name) or FFiles.ContainsKey(LowerCase(Name)) then
      raise EArgumentException.Create('The reviewed website contains an unsafe or oversized file.');
    Existing := FilePath(Name);
    if TDirectory.Exists(Existing) then raise EArgumentException.Create('A website file conflicts with an existing folder.');
    FZip.Read(Index, Bytes);
    FFiles.Add(LowerCase(Name), Name);
    FWrites.Add(Name);
    if TFile.Exists(Existing) then begin
      FOriginal.Add(Name, DigestFile(Existing));
      FChanged.Add(Name);
    end else FOriginal.Add(Name, '');
  end;
  for Name in FPrevious.Values do
    if not FFiles.ContainsKey(LowerCase(Name)) and TFile.Exists(FilePath(Name)) then begin
      FOriginal.Add(Name, DigestFile(FilePath(Name)));
      FRemoved.Add(Name);
    end;
  FChanged.Sort;
  FRemoved.Sort;
  FWrites.Sort;
end;

destructor TLocalWebsiteRefresh.Destroy;
begin
  FWrites.Free; FRemoved.Free; FChanged.Free; FOriginal.Free; FPrevious.Free; FFiles.Free; FZip.Free;
  inherited;
end;

function TLocalWebsiteRefresh.Summary: string;
begin
  Result := Format('Write %d website files to %s.' + sLineBreak +
    'Replace %d existing files and remove %d obsolete files previously managed by this project.' + sLineBreak +
    'Other files stay untouched. Existing affected files are backed up to a ZIP beside this test folder before anything is replaced.',
    [FFiles.Count, FFolder, FChanged.Count, FRemoved.Count]);
  if not FHadManifest and (FChanged.Count > 0) then
    Result := Result + sLineBreak + 'This is the first refresh in this folder. Existing files are adopted only where their filenames match the reviewed export.';
end;

function TLocalWebsiteRefresh.Details: string;
var Shown, Limit: Integer;
  function DisplayName(const Name: string): string;
  begin
    if Length(Name) > 72 then Result := Copy(Name, 1, 37) + '...' + Copy(Name, Length(Name) - 31, 32)
    else Result := Name;
  end;
begin
  if (FChanged.Count = 0) and (FRemoved.Count = 0) then Exit('No existing files will be replaced or removed.');
  Result := ''; Shown := 0;
  if FChanged.Count > 0 then begin
    Result := 'Existing files to replace:' + sLineBreak;
    if FRemoved.Count > 0 then Limit := 4 else Limit := 8;
    for var Index := 0 to FChanged.Count - 1 do begin
      if Index = Limit then Break;
      Result := Result + DisplayName(FChanged[Index]) + sLineBreak; Inc(Shown);
    end;
  end;
  if FRemoved.Count > 0 then begin
    Result := Result + 'Previously managed files to remove:' + sLineBreak;
    Limit := 8 - Shown;
    for var Index := 0 to FRemoved.Count - 1 do begin
      if Index = Limit then Break;
      Result := Result + DisplayName(FRemoved[Index]) + sLineBreak; Inc(Shown);
    end;
  end;
  Result := Result + Format('Showing %d of %d affected paths; long names are shortened.' + sLineBreak +
    'Review files shows the complete new website. The ZIP preserves every replaced or removed original.', [Shown, FChanged.Count + FRemoved.Count]);
end;

function TLocalWebsiteRefresh.Apply: string;
var BackupFolder, BackupTemporary, ManifestPath, Name, Expected, Actual: string;
  Backup: TZipFile; Bytes: TBytes; Id: TGUID; Applied: TStringList; AppliedHashes: TDictionary<string, string>;
  Manifest: TJSONObject; Files: TJSONArray; Item: TJSONObject; RecoveryFailed, ManifestTouched: Boolean;
  NewManifestHash: string;
begin
  ValidateFolder(FFolder);
  ManifestPath := TPath.Combine(FFolder, LocalWebsiteManifest);
  if FHadManifest then begin
    if not TFile.Exists(ManifestPath) or (DigestFile(ManifestPath) <> FManifestChecksum) then
      raise EInvalidOpException.Create('The local website manifest changed after review. Review the files again.');
  end else if TFile.Exists(ManifestPath) then
    raise EInvalidOpException.Create('The local website manifest changed after review. Review the files again.');
  for Name in FOriginal.Keys do begin
    Expected := FOriginal[Name];
    if TFile.Exists(FilePath(Name)) then Actual := DigestFile(FilePath(Name)) else Actual := '';
    if Actual <> Expected then raise EInvalidOpException.Create('The local files changed after review. Refresh again to review their current contents.');
  end;
  if CreateGUID(Id) <> 0 then raise EInvalidOpException.Create('Could not name the local website backup.');
  BackupFolder := FFolder + ' Backups';
  CheckNoReparse(BackupFolder);
  ForceDirectories(BackupFolder);
  FBackupPath := TPath.Combine(BackupFolder, 'website-before-' +
    FormatDateTime('yyyymmdd-hhnnss', TTimeZone.Local.ToUniversalTime(Now)) + '-' + GUIDToString(Id) + '.zip');
  BackupTemporary := FBackupPath + '.tmp';
  Backup := TZipFile.Create;
  try
    try
      Backup.Open(BackupTemporary, zmWrite);
      for Name in FOriginal.Keys do
        if FOriginal[Name] <> '' then Backup.Add(FilePath(Name), Name);
      if FHadManifest then Backup.Add(ManifestPath, LocalWebsiteManifest);
      Backup.Close;
      Backup.Open(BackupTemporary, zmRead);
      for var Index := 0 to Backup.FileCount - 1 do begin
        Backup.Read(Index, Bytes);
        Name := Backup.FileName[Index];
        if ((Name = LocalWebsiteManifest) and (DigestBytes(Bytes) <> FManifestChecksum)) or
          ((Name <> LocalWebsiteManifest) and (DigestBytes(Bytes) <> FOriginal[Name])) then
          raise EInvalidOpException.Create('The pre-refresh backup did not verify. No website files were changed.');
      end;
      Backup.Close;
      TFile.Move(BackupTemporary, FBackupPath);
    except
      Backup.Close;
      if TFile.Exists(BackupTemporary) then TFile.Delete(BackupTemporary);
      raise;
    end;
  finally Backup.Free end;
  Applied := TStringList.Create;
  AppliedHashes := TDictionary<string, string>.Create;
  ManifestTouched := False;
  try
    try
      for Name in FWrites do begin
        FZip.Read(Name, Bytes);
        if TFile.Exists(FilePath(Name)) then Actual := DigestFile(FilePath(Name)) else Actual := '';
        if Actual <> FOriginal[Name] then
          raise EInvalidOpException.Create('A local file changed during refresh. The previous website will be restored.');
        WriteAtomic(FilePath(Name), Bytes, FOriginal[Name], True);
        AppliedHashes.Add(Name, DigestBytes(Bytes));
        Applied.Add(Name);
      end;
      for Name in FRemoved do begin
        if TFile.Exists(FilePath(Name)) then Actual := DigestFile(FilePath(Name)) else Actual := '';
        if Actual <> FOriginal[Name] then
          raise EInvalidOpException.Create('A local file changed during refresh. The previous website will be restored.');
        TFile.Delete(FilePath(Name));
        AppliedHashes.Add(Name, '');
        Applied.Add(Name);
      end;
      Manifest := TJSONObject.Create;
      try
        Manifest.AddPair('format', 'webstudio-local-site');
        Manifest.AddPair('version', TJSONNumber.Create(1));
        Manifest.AddPair('projectId', FProjectId);
        Files := TJSONArray.Create; Manifest.AddPair('files', Files);
        for Name in FWrites do begin
          Item := TJSONObject.Create;
          Item.AddPair('path', Name); Item.AddPair('sha256', DigestFile(FilePath(Name))); Files.AddElement(Item);
        end;
        Bytes := TEncoding.UTF8.GetBytes(Manifest.ToJSON);
        NewManifestHash := DigestBytes(Bytes);
        WriteAtomic(ManifestPath, Bytes, FManifestChecksum, True);
        ManifestTouched := True;
        SetFileAttributes(PChar(ManifestPath), FILE_ATTRIBUTE_HIDDEN);
      finally Manifest.Free end;
    except
      RecoveryFailed := False;
      Backup := TZipFile.Create;
      try
        Backup.Open(FBackupPath, zmRead);
        for var Index := Applied.Count - 1 downto 0 do
          try
            Name := Applied[Index];
            if TFile.Exists(FilePath(Name)) then Actual := DigestFile(FilePath(Name)) else Actual := '';
            if Actual = FOriginal[Name] then Continue;
            if Actual <> AppliedHashes[Name] then begin RecoveryFailed := True; Continue end;
            if FOriginal[Name] = '' then begin
              if TFile.Exists(FilePath(Name)) then TFile.Delete(FilePath(Name));
            end else begin
              Backup.Read(Name, Bytes); WriteAtomic(FilePath(Name), Bytes, AppliedHashes[Name], True);
            end;
          except RecoveryFailed := True end;
        try
          if ManifestTouched then begin
            if TFile.Exists(ManifestPath) then Actual := DigestFile(ManifestPath) else Actual := '';
            if Actual <> FManifestChecksum then begin
              if Actual <> NewManifestHash then RecoveryFailed := True
              else if FHadManifest then begin Backup.Read(LocalWebsiteManifest, Bytes); WriteAtomic(ManifestPath, Bytes, NewManifestHash, True) end
              else if TFile.Exists(ManifestPath) then TFile.Delete(ManifestPath);
            end;
          end else begin
            if TFile.Exists(ManifestPath) then Actual := DigestFile(ManifestPath) else Actual := '';
            if Actual <> FManifestChecksum then RecoveryFailed := True;
          end;
        except RecoveryFailed := True end;
      finally Backup.Free end;
      if RecoveryFailed then raise EInvalidOpException.Create('Refresh failed. Some files need recovery from ' + FBackupPath);
      raise EInvalidOpException.Create('Refresh failed; the previous local files were restored. Backup: ' + FBackupPath);
    end;
  finally AppliedHashes.Free; Applied.Free end;
  Result := FBackupPath;
end;

class function TLocalWebsiteRefresh.ReadFiles(const Folder, ProjectId: string): TArray<string>;
var Reader: TLocalWebsiteRefresh;
begin
  Reader := TLocalWebsiteRefresh(TLocalWebsiteRefresh.NewInstance);
  try
    Reader.FFolder := ValidateFolder(Folder); Reader.FProjectId := ProjectId;
    Reader.FPrevious := TDictionary<string, string>.Create;
    Reader.ReadPrevious;
    if not Reader.FHadManifest then raise EInvalidOpException.Create('Refresh the local site before opening it.');
    Result := Reader.FPrevious.Values.ToArray;
  finally Reader.Free end;
end;

end.
