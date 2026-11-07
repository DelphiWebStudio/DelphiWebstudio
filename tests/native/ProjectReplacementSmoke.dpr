program ProjectReplacementSmoke;
{$APPTYPE CONSOLE}
{$B-}
{ Uses only newly created synthetic files; never points at user projects. }
uses Winapi.Windows, System.SysUtils, System.Classes, System.IOUtils,
  WebStudio.ProjectSave in '..\..\desktop\project\WebStudio.ProjectSave.pas',
  WebStudio.ProjectOpen in '..\..\desktop\project\WebStudio.ProjectOpen.pas';
procedure CaptureVersion(const Path: string; out Info: TByHandleFileInformation);
var Handle: THandle;
begin
  Handle := CreateFile(PChar(Path), GENERIC_READ, FILE_SHARE_READ or FILE_SHARE_DELETE, nil, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, 0);
  if Handle = INVALID_HANDLE_VALUE then RaiseLastOSError;
  try if not GetFileInformationByHandle(Handle, Info) then RaiseLastOSError finally CloseHandle(Handle) end;
end;
var Id: TGUID; Folder, Target, Stage, Retained, Missing, HardTarget, HardStage: string;
  Locked: TFileStream; Rejected: Boolean;
  Expected, ExpectedStage, Stale: TByHandleFileInformation;
begin
  if CreateGUID(Id) <> 0 then raise Exception.Create('Could not make test ID.');
  Folder := TPath.Combine(TPath.Combine(GetCurrentDir, 'test-results'), 'replace-project-' + GUIDToString(Id));
  if TDirectory.Exists(Folder) then raise Exception.Create('Test folder already exists.');
  TDirectory.CreateDirectory(Folder);
  Target := TPath.Combine(Folder, 'project.webstudio.json');
  Stage := TPath.Combine(Folder, 'stage.tmp');
  Missing := TPath.Combine(Folder, 'missing.webstudio.json');
  SaveNewProjectFile(Target, TEncoding.UTF8.GetBytes('last good project'));
  SaveNewProjectFile(Stage, TEncoding.UTF8.GetBytes('new project data'));
  CaptureVersion(Target, Expected); CaptureVersion(Stage, ExpectedStage);
  Rejected := False;
  try ReplaceStagedProjectFile(Stage, Missing, Expected, ExpectedStage, Retained) except on E: Exception do Rejected := True end;
  if not Rejected or not TFile.Exists(Stage) or TFile.Exists(Missing) then raise Exception.Create('Missing target was accepted.');
  Rejected := False;
  try ReplaceStagedProjectFile(Target, Target, Expected, ExpectedStage, Retained) except on E: EArgumentException do Rejected := True end;
  if not Rejected or not TFile.Exists(Target) then raise Exception.Create('Identical stage and target were accepted.');
  Locked := TFileStream.Create(Target, fmOpenWrite or fmShareExclusive);
  try
    Rejected := False;
    try ReplaceStagedProjectFile(Stage, Target, Expected, ExpectedStage, Retained) except on E: Exception do Rejected := True end;
    if not Rejected or not TFile.Exists(Stage) then raise Exception.Create('Locked target was replaced.');
  finally Locked.Free end;
  Locked := TFileStream.Create(Stage, fmOpenRead or fmShareExclusive);
  try
    Rejected := False;
    try ReplaceStagedProjectFile(Stage, Target, Expected, ExpectedStage, Retained) except on E: Exception do Rejected := True end;
    if not Rejected or (TFile.ReadAllText(Target) <> 'last good project') then raise Exception.Create('Locked stage replaced the project.');
  finally Locked.Free end;
  Stale := Expected; Inc(Stale.nFileSizeLow); Rejected := False;
  try ReplaceStagedProjectFile(Stage, Target, Stale, ExpectedStage, Retained) except on E: Exception do Rejected := True end;
  if not Rejected or not TFile.Exists(Stage) or (TFile.ReadAllText(Target) <> 'last good project') then raise Exception.Create('Changed original was replaced.');
  Stale := ExpectedStage; Inc(Stale.nFileSizeLow); Rejected := False;
  try ReplaceStagedProjectFile(Stage, Target, Expected, Stale, Retained) except on E: Exception do Rejected := True end;
  if not Rejected or not TFile.Exists(Stage) or (TFile.ReadAllText(Target) <> 'last good project') then raise Exception.Create('Changed stage was accepted.');
  ReplaceStagedProjectFile(Stage, Target, Expected, ExpectedStage, Retained);
  if TFile.Exists(Stage) or (TFile.ReadAllText(Target) <> 'new project data') or (Retained <> '') then raise Exception.Create('Replacement did not finish cleanly.');
  if (Length(TDirectory.GetFiles(Folder, '.webstudio-previous-*')) <> 0) or (Length(TDirectory.GetDirectories(Folder, '.webstudio-recovery-*')) <> 0) then raise Exception.Create('A previous project remained after saving.');
  SaveNewProjectFile(Stage, TEncoding.UTF8.GetBytes('third project data'));
  CaptureVersion(Stage, ExpectedStage); CaptureVersion(Target, Expected);
  ReplaceStagedProjectFile(Stage, Target, Expected, ExpectedStage, Retained);
  if (TFile.ReadAllText(Target) <> 'third project data') or (Retained <> '') or (Length(TDirectory.GetFiles(Folder, '.webstudio-previous-*')) <> 0) then raise Exception.Create('Repeated save left an original behind.');
  Target := TPath.Combine(Folder, 'caf' + #$00E9 + '-' + #$4F1A + '.webstudio.json');
  SaveNewProjectFile(Target, TEncoding.UTF8.GetBytes('unicode original'));
  SaveNewProjectFile(Stage, TEncoding.UTF8.GetBytes('unicode replacement'));
  CaptureVersion(Stage, ExpectedStage); CaptureVersion(Target, Expected);
  ReplaceStagedProjectFile(Stage, Target, Expected, ExpectedStage, Retained);
  if (TFile.ReadAllText(Target) <> 'unicode replacement') or (Retained <> '') then raise Exception.Create('Unicode replacement failed.');
  HardTarget := TPath.Combine(Folder, 'hardlink-target.webstudio.json'); HardStage := TPath.Combine(Folder, 'hardlink-stage.tmp');
  SaveNewProjectFile(HardTarget, TEncoding.UTF8.GetBytes('hardlink original'));
  if not CreateHardLink(PChar(HardStage), PChar(HardTarget), nil) then RaiseLastOSError;
  CaptureVersion(HardTarget, Expected); CaptureVersion(HardStage, ExpectedStage); Rejected := False;
  try ReplaceStagedProjectFile(HardStage, HardTarget, Expected, ExpectedStage, Retained) except on E: Exception do Rejected := True end;
  if not Rejected or not TFile.Exists(HardStage) or (TFile.ReadAllText(HardTarget) <> 'hardlink original') then raise Exception.Create('A stage hardlinked to the target was accepted.');
  Writeln('Successful replacements leave only the current file; unsafe replacements were rejected.');
end.
