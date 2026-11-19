program LocalWebsiteSmoke;
{$APPTYPE CONSOLE}
{$B-}
uses
  Winapi.Windows, System.SysUtils, System.Classes, System.IOUtils, System.Zip,
  System.Net.HttpClient, System.Generics.Collections,
  WebStudio.LocalWebsite in '..\..\desktop\project\WebStudio.LocalWebsite.pas',
  WebStudio.WebsitePreview in '..\..\desktop\project\WebStudio.WebsitePreview.pas',
  WebStudio.ExternalLinks in '..\..\desktop\project\WebStudio.ExternalLinks.pas';

procedure Check(Condition: Boolean; const Description: string);
begin
  if not Condition then raise Exception.Create(Description);
  Writeln('PASS: ' + Description);
end;

procedure WriteZip(const FileName, Body: string; Extra: Boolean);
var Zip: TZipFile;
begin
  Zip := TZipFile.Create;
  try
    Zip.Open(FileName, zmWrite);
    Zip.Add(TEncoding.UTF8.GetBytes(Body), 'index.html');
    Zip.Add(TEncoding.UTF8.GetBytes('window.syntheticTranslation = true;'), 'assets/translation-selector.js');
    Zip.Add(TEncoding.UTF8.GetBytes('<h1>Visit</h1>'), 'visit/team.html');
    if Extra then Zip.Add(TEncoding.UTF8.GetBytes('previous managed image'), 'assets/old.txt');
  finally Zip.Free end;
end;

procedure CheckConcurrentEditRollback(const Root: string; Existing: Boolean);
var Folder, Archive, FirstFile, ManifestFile: string; Zip: TZipFile;
  Plan: TLocalWebsiteRefresh; Lock: TFileStream; Watcher: TThread;
  Big: TBytes; Edited, Rejected: Boolean; Failure: string;
begin
  Folder := TPath.Combine(Root, 'Concurrent-' + BoolToStr(Existing, True));
  ForceDirectories(Folder);
  FirstFile := TPath.Combine(Folder, 'a-first.html');
  ManifestFile := TPath.Combine(Folder, LocalWebsiteManifest);
  if Existing then TFile.WriteAllText(FirstFile, 'Previous first file');
  TFile.WriteAllText(TPath.Combine(Folder, 'z-locked.html'), 'Original locked file');
  Archive := Folder + '.zip'; Zip := TZipFile.Create;
  try
    Zip.Open(Archive, zmWrite);
    Zip.Add(TEncoding.UTF8.GetBytes('Written by refresh'), 'a-first.html');
    Zip.Add(TEncoding.UTF8.GetBytes('<h1>Synthetic site</h1>'), 'index.html');
    SetLength(Big, 8 * 1024 * 1024); Zip.Add(Big, 'm-buffer.bin');
    Zip.Add(TEncoding.UTF8.GetBytes('New locked file'), 'z-locked.html');
  finally Zip.Free end;
  Plan := TLocalWebsiteRefresh.Create(Folder, Archive, 'concurrent-project');
  Lock := TFileStream.Create(TPath.Combine(Folder, 'z-locked.html'), fmOpenRead or fmShareDenyWrite);
  Edited := False; Rejected := False; Failure := '';
  Watcher := TThread.CreateAnonymousThread(procedure
    var Deadline: UInt64;
    begin
      Deadline := GetTickCount64 + 5000;
      while GetTickCount64 < Deadline do begin
        try
          if TFile.Exists(FirstFile) and TFile.ReadAllText(FirstFile).Contains('Written by refresh') then begin
            TFile.WriteAllText(FirstFile, 'User edit during refresh');
            TFile.WriteAllText(ManifestFile, 'User manifest during refresh');
            Edited := True; Exit;
          end;
        except { The next iteration waits for the atomic rename to finish. } end;
        Sleep(1);
      end;
    end);
  Watcher.FreeOnTerminate := False;
  try
    Watcher.Start;
    try Plan.Apply except on E: Exception do begin Rejected := True; Failure := E.Message end end;
    Watcher.WaitFor;
    Check(Edited and Rejected, 'concurrent edit reached the synthetic late-failure scenario');
    Check(TFile.ReadAllText(FirstFile).Contains('User edit during refresh'), 'rollback preserves a concurrent edit to a replaced or newly created file');
    Check(TFile.ReadAllText(ManifestFile).Contains('User manifest during refresh'), 'rollback preserves an external manifest it never wrote');
    Check(Failure.Contains('need recovery'), 'concurrent changes produce an honest manual-recovery message');
  finally Watcher.Free; Lock.Free; Plan.Free end;
end;

var
  Root, Folder, Zip1, Zip2, Backup1, Backup2, Address: string;
  Plan: TLocalWebsiteRefresh; Preview: TWebsitePreview; Client: THTTPClient;
  Response: IHTTPResponse; Lock: TFileStream; Rejected: Boolean;
begin
  try
    Root := TPath.GetFullPath(ParamStr(1));
    if not Root.Contains('.local-site-smoke') or TDirectory.Exists(Root) then
      raise Exception.Create('Supply a fresh synthetic .local-site-smoke folder.');
    Folder := TPath.Combine(Root, 'Local Site'); ForceDirectories(Folder);
    TFile.WriteAllText(TPath.Combine(Folder, 'index.html'), 'Previous website', TEncoding.UTF8);
    TFile.WriteAllText(TPath.Combine(Folder, 'notes.txt'), 'Unrelated private notes', TEncoding.UTF8);
    TFile.WriteAllText(TPath.Combine(Folder, 'old-unmanaged.txt'), 'Existing untracked file', TEncoding.UTF8);
    Zip1 := TPath.Combine(Root, 'first.zip'); Zip2 := TPath.Combine(Root, 'second.zip');
    WriteZip(Zip1, '<html><h1>Welcome</h1></html>', True);
    WriteZip(Zip2, '<html><h1>Updated</h1></html>', False);
    Plan := TLocalWebsiteRefresh.Create(Folder, Zip1, 'synthetic-project');
    try
      Check(Plan.Details.Contains('index.html'), 'first-use overwrite is explicitly listed');
      Backup1 := Plan.Apply;
    finally Plan.Free end;
    Check(TFile.Exists(Backup1) and not Backup1.StartsWith(Folder + '\'), 'pre-refresh ZIP is outside the served folder');
    Check(TFile.ReadAllText(TPath.Combine(Folder, 'notes.txt')).Contains('Unrelated private notes'), 'unmanaged files are preserved');
    Check(Length(TLocalWebsiteRefresh.ReadFiles(Folder, 'synthetic-project')) = 4, 'managed manifest records only exported files');
    Preview := TWebsitePreview.CreateFolder(Folder, 'synthetic-token', TLocalWebsiteRefresh.ReadFiles(Folder, 'synthetic-project'));
    Client := THTTPClient.Create;
    try
      Address := Preview.Address;
      Response := Client.Get(Address);
      Check((Response.StatusCode = 200) and Response.ContentAsString.Contains('Welcome'), 'persistent folder served through loopback HTTP');
      Check(Response.HeaderValue['Content-Security-Policy'].Contains('https://translate-pa.googleapis.com') and
        Response.HeaderValue['Content-Security-Policy'].Contains('form-action ''none'''), 'translation endpoint and form protection retained');
      Check(Client.Get(Address.Replace('index.html', 'notes.txt')).StatusCode = 404, 'unmanaged private file is not served');
      Check(Client.Get(Address.Replace('index.html', LocalWebsiteManifest)).StatusCode = 404, 'local manifest is not served');
      Check(Client.Get(Address.Replace('index.html', 'visit/team.html')).StatusCode = 200, 'nested page served');
    finally Client.Free; Preview.Free end;
    Plan := TLocalWebsiteRefresh.Create(Folder, Zip2, 'synthetic-project');
    try Backup2 := Plan.Apply finally Plan.Free end;
    Check(TFile.Exists(Backup2) and not SameText(Backup1, Backup2), 'each refresh has its own pre-change ZIP');
    Check(not TFile.Exists(TPath.Combine(Folder, 'assets\old.txt')), 'obsolete managed file removed');
    Check(TFile.Exists(TPath.Combine(Folder, 'old-unmanaged.txt')), 'obsolete unmanaged file remains');
    Check(TFile.ReadAllText(TPath.Combine(Folder, 'index.html')).Contains('Updated'), 'new index installed');
    Plan := TLocalWebsiteRefresh.Create(Folder, Zip1, 'synthetic-project');
    try
      TFile.WriteAllText(TPath.Combine(Folder, 'index.html'), 'Changed during review');
      Rejected := False;
      try Plan.Apply except Rejected := True end;
      Check(Rejected and TFile.ReadAllText(TPath.Combine(Folder, 'index.html')).Contains('Changed during review'), 'changes after review are preserved and rejected');
    finally Plan.Free end;
    Plan := TLocalWebsiteRefresh.Create(Folder, Zip2, 'synthetic-project');
    try
      Lock := TFileStream.Create(TPath.Combine(Folder, 'visit\team.html'), fmOpenRead or fmShareDenyWrite);
      try
        Rejected := False;
        try Plan.Apply except Rejected := True end;
        Check(Rejected and TFile.ReadAllText(TPath.Combine(Folder, 'index.html')).Contains('Changed during review'), 'failed replacement restores the previous index');
        Check(TFile.ReadAllText(TPath.Combine(Folder, 'visit\team.html')).Contains('Visit'), 'locked original is preserved');
      finally Lock.Free end;
    finally Plan.Free end;
    Rejected := False;
    try TLocalWebsiteRefresh.ReadFiles(Folder, 'different-project') except Rejected := True end;
    Check(Rejected, 'another project cannot adopt a managed folder silently');
    var Worktree := TPath.Combine(Root, 'synthetic-worktree'); ForceDirectories(Worktree);
    TFile.WriteAllText(TPath.Combine(Worktree, '.git'), 'gitdir: synthetic-only');
    Rejected := False;
    try TLocalWebsiteRefresh.ValidateFolder(Worktree) except Rejected := True end;
    Check(Rejected, 'Git worktrees with a .git file cannot be selected');
    var ApplicationChild := TPath.Combine(ExtractFilePath(ParamStr(0)), 'synthetic-editor-subfolder');
    ForceDirectories(ApplicationChild);
    Rejected := False;
    try TLocalWebsiteRefresh.ValidateFolder(ApplicationChild) except Rejected := True end;
    Check(Rejected, 'application subfolders cannot be selected');
    for var ProtectedFolder in TArray<string>.Create(GetEnvironmentVariable('ProgramFiles'),
      GetEnvironmentVariable('ProgramFiles(x86)'), GetEnvironmentVariable('ProgramW6432')) do
      if (ProtectedFolder <> '') and TDirectory.Exists(ProtectedFolder) then begin
        Rejected := False;
        try TLocalWebsiteRefresh.ValidateFolder(ProtectedFolder) except Rejected := True end;
        Check(Rejected, 'both Windows program-folder roots are protected');
      end;
    CheckConcurrentEditRollback(Root, True);
    CheckConcurrentEditRollback(Root, False);
    var LinkResults := CheckExternalLinks(['http://127.0.0.1/', 'http://localhost/', 'http://169.254.169.254/', 'file:///private', 'https://example.com:22/']);
    Check(not LinkResults.Contains('"status":"ok"') and LinkResults.Contains('"status":"blocked"'), 'private and non-web destinations blocked');
    if ParamStr(2) = '--public-links' then begin
      LinkResults := CheckExternalLinks(['https://www.w3.org/', 'https://www.w3.org/this-path-does-not-exist-webstudio-check', 'https://expired.badssl.com/']);
      Writeln('PUBLIC LINK RESULTS: ' + LinkResults);
      Check(LinkResults.Contains('"status":"ok"'), 'live HTTPS succeeds with checked-IP pin and original TLS hostname');
      Check(LinkResults.Contains('"status":"broken"'), 'live missing page identified');
      Check(not LinkResults.Contains('"url":"https://expired.badssl.com/","status":"ok"'), 'invalid HTTPS certificate is never accepted');
    end;
    Writeln('LOCAL WEBSITE SMOKE PASSED');
  except on E: Exception do begin Writeln('FAIL: ' + E.Message); ExitCode := 1 end end;
end.
