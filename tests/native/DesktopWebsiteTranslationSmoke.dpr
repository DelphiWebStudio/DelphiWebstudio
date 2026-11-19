program DesktopWebsiteTranslationSmoke;
{$APPTYPE CONSOLE}
{$B-}
{ Compile beside an actual staged editor bundle and matching WebView2Loader.dll
  in a disposable folder whose path contains .website-translation. Set
  LOCALAPPDATA to a fresh isolated subfolder containing the same marker.
  The harness creates only synthetic two-page fixtures and website ZIPs. }
uses
  Winapi.Windows, Winapi.Messages, Winapi.WebView2, Winapi.CommDlg, Winapi.Dlgs,
  System.SysUtils, System.Classes, System.IOUtils, System.JSON, System.Zip,
  Vcl.Forms, Vcl.Edge, Vcl.Dialogs, Vcl.ExtCtrls,
  WebStudio.Main in '..\..\desktop\DelphiWebStudio\WebStudio.Main.pas';

type
  TDevToolsResult = class(TInterfacedObject, ICoreWebView2CallDevToolsProtocolMethodCompletedHandler)
    Done: Boolean;
    Data: string;
    Code: HResult;
    function Invoke(errorCode: HResult; resultJSON: PWideChar): HResult; stdcall;
  end;
  TDownloadDriver = class
    Count: Integer;
    ChosenPath: string;
    DialogWindow: HWND;
    Timer: TTimer;
    procedure Shown(Sender: TObject);
    procedure Accept(Sender: TObject);
  end;

function TDevToolsResult.Invoke(errorCode: HResult; resultJSON: PWideChar): HResult;
begin
  Code := errorCode;
  if resultJSON <> nil then Data := string(resultJSON);
  Done := True;
  Result := S_OK;
end;

procedure TDownloadDriver.Shown(Sender: TObject);
begin
  Inc(Count);
  if (ChosenPath = '') or TFile.Exists(ChosenPath) then
    raise Exception.Create('A fresh synthetic download destination is required.');
  DialogWindow := TSaveDialog(Sender).Handle;
  Timer.Enabled := True;
end;

procedure TDownloadDriver.Accept(Sender: TObject);
begin
  Timer.Enabled := False;
  if not SetDlgItemText(DialogWindow, edt1, PChar(ChosenPath)) then begin
    PostMessage(DialogWindow, WM_COMMAND, IDCANCEL, 0);
    Exit;
  end;
  PostMessage(DialogWindow, WM_COMMAND, IDOK, 0);
end;

function CDP(const Method, Params: string): string;
var
  Handler: TDevToolsResult;
  Keep: ICoreWebView2CallDevToolsProtocolMethodCompletedHandler;
  Deadline: UInt64;
begin
  Handler := TDevToolsResult.Create;
  Keep := Handler;
  if Winapi.Windows.Failed(MainForm.EditorBrowser.DefaultInterface.CallDevToolsProtocolMethod(PChar(Method), PChar(Params), Keep)) then
    raise Exception.Create('DevTools request failed: ' + Method);
  Deadline := GetTickCount64 + 10000;
  while not Handler.Done and (GetTickCount64 < Deadline) do begin
    CheckSynchronize(0); Application.ProcessMessages; Sleep(10);
  end;
  if not Handler.Done or Winapi.Windows.Failed(Handler.Code) then
    raise Exception.Create('DevTools response failed: ' + Method);
  Result := Handler.Data;
end;

procedure WaitTrue(const Script, Description: string);
var Deadline: UInt64; Value: string;
begin
  Writeln('Waiting: ' + Description); Flush(Output);
  Deadline := GetTickCount64 + 30000;
  repeat
    CheckSynchronize(0); Application.ProcessMessages; Sleep(30);
    Value := MainForm.EditorBrowser.ExecuteScript(Script, '');
  until (Value = 'true') or (GetTickCount64 >= Deadline);
  if Value <> 'true' then
    raise Exception.Create(Description + ': ' + Value + ' / ' + MainForm.StatusLabel.Caption + ' / ' + MainForm.EditorBrowser.ExecuteScript('document.body.innerText', ''));
  Writeln('PASS: ' + Description); Flush(Output);
end;

procedure OpenFixture(const FileName: string);
var DocumentValue, Query, Answer, Params: TJSONObject; Files: TJSONArray; RootId, NodeId: Integer;
begin
  DocumentValue := TJSONObject.ParseJSONValue(CDP('DOM.getDocument', '{}')) as TJSONObject;
  try RootId := DocumentValue.GetValue<TJSONObject>('root').GetValue<Integer>('nodeId');
  finally DocumentValue.Free end;
  Query := TJSONObject.Create;
  try
    Query.AddPair('nodeId', TJSONNumber.Create(RootId));
    Query.AddPair('selector', '[aria-label="Choose project file"]');
    Answer := TJSONObject.ParseJSONValue(CDP('DOM.querySelector', Query.ToJSON)) as TJSONObject;
    try NodeId := Answer.GetValue<Integer>('nodeId'); finally Answer.Free end;
  finally Query.Free end;
  if NodeId = 0 then raise Exception.Create('Project file chooser not found.');
  Params := TJSONObject.Create;
  try
    Params.AddPair('nodeId', TJSONNumber.Create(NodeId));
    Files := TJSONArray.Create; Files.Add(FileName); Params.AddPair('files', Files);
    CDP('DOM.setFileInputFiles', Params.ToJSON);
  finally Params.Free end;
  WaitTrue('Array.from(document.querySelectorAll("[role=status]")).some(e=>e.textContent.startsWith("Saved") && e.title.includes("translation.webstudio.json"))', 'Synthetic project opened');
end;

function ProjectConfig(const FileName: string): string;
var Data: TJSONObject;
begin
  Data := TJSONObject.ParseJSONValue(TFile.ReadAllText(FileName)) as TJSONObject;
  try Result := Data.GetValue<TJSONObject>('config').ToJSON; finally Data.Free end;
end;

procedure WaitSavedSetting(const FileName: string; Expected: Boolean);
var Deadline: UInt64; Data, Settings: TJSONObject; Saved: Boolean;
begin
  Deadline := GetTickCount64 + 30000;
  repeat
    CheckSynchronize(0); Application.ProcessMessages; Sleep(30);
    Saved := False;
    Data := TJSONObject.ParseJSONValue(TFile.ReadAllText(FileName)) as TJSONObject;
    try
      Settings := nil;
      Data.TryGetValue<TJSONObject>('settings', Settings);
      if (Settings <> nil) and (Settings.GetValue('websiteTranslation') is TJSONBool) then
        Saved := Settings.GetValue<Boolean>('websiteTranslation') = Expected;
    finally Data.Free end;
  until Saved or (GetTickCount64 >= Deadline);
  if not Saved then raise Exception.Create('Website translation was not saved as a JSON boolean. / ' + MainForm.StatusLabel.Caption + ' / ' + MainForm.EditorBrowser.ExecuteScript('document.body.innerText', ''));
  WaitTrue('Array.from(document.querySelectorAll("[role=status]")).some(e=>e.textContent.startsWith("Saved"))', 'Native project save completed');
end;

procedure SaveFromEditor(const FileName: string; Expected: Boolean);
begin
  MainForm.EditorBrowser.ExecuteScript('location.hash="/editor"');
  WaitTrue('!!document.querySelector("[data-project-command=save]") && !document.querySelector("[data-project-command=save]").disabled && Array.from(document.querySelectorAll("[role=status]")).some(e=>e.textContent.startsWith("Unsaved changes"))', 'Editor save controls');
  MainForm.SaveProjectItemClick(nil);
  WaitSavedSetting(FileName, Expected);
end;

procedure CheckWebsite(const FileName: string; TranslationEnabled: Boolean);
var Archive: TZipFile; Bytes: TBytes; Page, Html, HelperPath: string;
begin
  Archive := TZipFile.Create;
  try
    Archive.Open(FileName, zmRead);
    if (Archive.IndexOf('assets/translation-selector.js') >= 0) <> TranslationEnabled then
      raise Exception.Create('Exported translation asset did not match its setting.');
    for Page in ['index.html', 'community/visit.html'] do begin
      if Archive.IndexOf(Page) < 0 then raise Exception.Create('Exported page is missing: ' + Page);
      Archive.Read(Archive.IndexOf(Page), Bytes);
      Html := TEncoding.UTF8.GetString(Bytes);
      if TranslationEnabled then begin
        if Page = 'index.html' then HelperPath := 'assets/translation-selector.js'
        else HelperPath := '../assets/translation-selector.js';
        if not Html.Contains('src="' + HelperPath + '"') or
          not Html.Contains('https://cdn.gtranslate.net/widgets/latest/float.js') or
          not Html.Contains('"detect_browser_language":true') or
          (Html.IndexOf('data-ws-translation-vendor') <> Html.LastIndexOf('data-ws-translation-vendor')) then
          raise Exception.Create('Translation markup or relative asset path is incorrect: ' + Page);
      end else if Html.Contains('gtranslate') then
        raise Exception.Create('Disabled translation exported a vendor integration.');
      if not Html.Contains('Original synthetic wording') then
        raise Exception.Create('Export changed the original website wording.');
    end;
  finally Archive.Free end;
end;

procedure DownloadReviewedWebsite(Driver: TDownloadDriver; const FileName: string; Enabled: Boolean);
var Deadline: UInt64;
begin
  MainForm.EditorBrowser.ExecuteScript('location.hash="/deploy"');
  WaitTrue('Array.from(document.querySelectorAll("button")).some(e=>e.textContent==="Review files")', 'Website export screen');
  MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("button")).find(e=>e.textContent==="Review files").click()');
  WaitTrue('!!document.querySelector("[aria-label=\"Website files\"]") && Array.from(document.querySelectorAll("button")).some(e=>e.textContent==="Download reviewed ZIP")', 'Prepared website ZIP');
  if Enabled then WaitTrue('document.querySelector("[aria-label=\"Website files\"]").textContent.includes("assets/translation-selector.js")', 'Translation asset appears in review')
  else WaitTrue('!document.querySelector("[aria-label=\"Website files\"]").textContent.includes("translation-selector.js")', 'Disabled translation absent from review');
  Driver.ChosenPath := FileName;
  MainForm.StatusLabel.Caption := 'Waiting for synthetic website download';
  MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("button")).find(e=>e.textContent==="Download reviewed ZIP").click()');
  Deadline := GetTickCount64 + 30000;
  while (not TFile.Exists(FileName) or (MainForm.StatusLabel.Caption <> 'Download completed: ' + ExtractFileName(FileName))) and (GetTickCount64 < Deadline) do begin
    CheckSynchronize(0); Application.ProcessMessages; Sleep(30);
  end;
  if not TFile.Exists(FileName) or (MainForm.StatusLabel.Caption <> 'Download completed: ' + ExtractFileName(FileName)) then
    raise Exception.Create('Website ZIP download did not complete: ' + MainForm.StatusLabel.Caption);
  CheckWebsite(FileName, Enabled);
end;

const
  Fixture = '{"format":"webstudio","schemaVersion":2,"projectId":"translation-native-fixture","config":{"name":"Translation native fixture","blocks":[{"id":"home-content","type":"content","variant":"prose","props":{"body":"# Original synthetic wording\nWelcome to the community."}}],"pages":[{"id":"home","name":"Home","path":"/","blocks":[{"id":"home-content","type":"content","variant":"prose","props":{"body":"# Original synthetic wording\nWelcome to the community."}}]},{"id":"visit","name":"Visit","path":"/community/visit","blocks":[{"id":"visit-content","type":"content","variant":"prose","props":{"body":"# Original synthetic wording\nJoin our community activities."}}]}]},"assets":[]}';
var Folder, OpenFile, Sentinel, Original, EditorPolicy: string; Driver: TDownloadDriver; CanClose: Boolean;
begin
  Folder := ExtractFilePath(ParamStr(0));
  if not LowerCase(Folder).Contains('.website-translation') or
    not LowerCase(GetEnvironmentVariable('LOCALAPPDATA')).Contains('.website-translation') then
    raise Exception.Create('A disposable test folder and isolated LOCALAPPDATA profile are required.');
  OpenFile := TPath.Combine(Folder, 'translation.webstudio.json');
  Sentinel := TPath.Combine(Folder, 'preserve-user-project.sentinel');
  if TFile.Exists(OpenFile) or TFile.Exists(Sentinel) then raise Exception.Create('Fresh synthetic fixture paths are required.');
  TFile.WriteAllText(OpenFile, Fixture, TEncoding.UTF8);
  TFile.WriteAllText(Sentinel, 'Preserve this unrelated synthetic project.', TEncoding.UTF8);
  Original := ProjectConfig(OpenFile);
  Driver := TDownloadDriver.Create;
  Driver.Timer := TTimer.Create(nil); Driver.Timer.Enabled := False; Driver.Timer.Interval := 200; Driver.Timer.OnTimer := Driver.Accept;
  UseLatestCommonDialogs := False;
  Application.Initialize; Application.ShowMainForm := False; Application.CreateForm(TMainForm, MainForm);
  try
    MainForm.SaveDownloadDialog.Options := MainForm.SaveDownloadDialog.Options + [ofOldStyleDialog];
    MainForm.SaveDownloadDialog.OnShow := Driver.Shown;
    WaitTrue('!!document.querySelector("[data-project-command=open]")', 'Native editor startup');
    if Winapi.Windows.Failed(MainForm.EditorBrowser.ControllerInterface.Set_IsVisible(1)) then raise Exception.Create('WebView visibility failed.');
    EditorPolicy := MainForm.EditorBrowser.ExecuteScript('document.querySelector("meta[http-equiv=\"Content-Security-Policy\"]")?.content || ""', '');
    OpenFixture(OpenFile);
    MainForm.EditorBrowser.ExecuteScript('location.hash="/settings"');
    WaitTrue('!!document.querySelector("input[aria-describedby=website-translation-description]") && !document.querySelector("input[aria-describedby=website-translation-description]").checked', 'Translation defaults off');
    MainForm.EditorBrowser.ExecuteScript('document.querySelector("input[aria-describedby=website-translation-description]").click()');
    WaitTrue('document.querySelector("input[aria-describedby=website-translation-description]").checked', 'Translation enabled through Settings');
    SaveFromEditor(OpenFile, True);
    if ProjectConfig(OpenFile) <> Original then raise Exception.Create('Enabling translation changed the saved page configuration.');
    OpenFixture(OpenFile);
    MainForm.EditorBrowser.ExecuteScript('location.hash="/settings"');
    WaitTrue('!!document.querySelector("input[aria-describedby=website-translation-description]") && document.querySelector("input[aria-describedby=website-translation-description]").checked', 'Translation survives project reopen');
    DownloadReviewedWebsite(Driver, TPath.Combine(Folder, 'website-on.zip'), True);
    MainForm.EditorBrowser.ExecuteScript('location.hash="/settings"');
    WaitTrue('!!document.querySelector("input[aria-describedby=website-translation-description]")', 'Settings reopened');
    MainForm.EditorBrowser.ExecuteScript('document.querySelector("input[aria-describedby=website-translation-description]").click()');
    SaveFromEditor(OpenFile, False);
    DownloadReviewedWebsite(Driver, TPath.Combine(Folder, 'website-off.zip'), False);
    WaitTrue('!document.querySelector(".gtranslate_wrapper,script[src*=gtranslate]") && typeof window.gtranslateSettings==="undefined"', 'Privileged editor has no translation runtime');
    if MainForm.EditorBrowser.ExecuteScript('document.querySelector("meta[http-equiv=\"Content-Security-Policy\"]")?.content || ""', '') <> EditorPolicy then
      raise Exception.Create('Editor security policy changed.');
    if ProjectConfig(OpenFile) <> Original then raise Exception.Create('Translation changed saved page wording.');
    if TFile.ReadAllText(Sentinel) <> 'Preserve this unrelated synthetic project.' then raise Exception.Create('Unrelated project sentinel changed.');
    if Driver.Count <> 2 then raise Exception.Create('Unexpected native save-dialog count.');
    CanClose := False; MainForm.FormCloseQuery(nil, CanClose);
    if not CanClose then raise Exception.Create('Saved project unexpectedly remained dirty.');
    Writeln('PASS: native translation default-off, Settings enable/save/reopen, on/off reviewed ZIP exports, original wording and isolated editor security.');
  finally MainForm.Free; Driver.Timer.Free; Driver.Free end;
end.
