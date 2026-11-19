program DesktopMaintenanceSmoke;
{$APPTYPE CONSOLE}
{$B-}
uses
  Winapi.Windows, Winapi.Messages, Winapi.WebView2, Winapi.ActiveX, Winapi.ShlObj,
  System.SysUtils, System.Classes, System.IOUtils, System.JSON, System.IniFiles, System.Win.ComObj,
  Vcl.Forms, Vcl.Edge, Vcl.Dialogs, Vcl.ExtCtrls, Vcl.Graphics, Vcl.Imaging.pngimage, Vcl.XPMan,
  WebStudio.Main in '..\..\desktop\DelphiWebStudio\WebStudio.Main.pas';

type
  TDevToolsResult = class(TInterfacedObject, ICoreWebView2CallDevToolsProtocolMethodCompletedHandler)
    Done: Boolean;
    Data: string;
    Code: HResult;
    function Invoke(errorCode: HResult; resultJSON: PWideChar): HResult; stdcall;
  end;
  TDialogDriver = class
    Timer: TTimer;
    Folder, CaptureFolder, Error: string;
    Mode: Integer;
    AcceptRefresh: Boolean;
    FolderCount, ConfirmCount, MaximumHeight: Integer;
    procedure FolderShown(Sender: TObject);
    procedure ConfirmShown(Sender: TObject);
    procedure Tick(Sender: TObject);
  end;

function TDevToolsResult.Invoke(errorCode: HResult; resultJSON: PWideChar): HResult;
begin Code := errorCode; if resultJSON <> nil then Data := string(resultJSON); Done := True; Result := S_OK end;

procedure TDialogDriver.FolderShown(Sender: TObject);
var Item: IShellItem;
begin
  OleCheck(SHCreateItemFromParsingName(PChar(Folder), nil, IShellItem, Item));
  OleCheck(MainForm.LocalWebsiteFolderDialog.Dialog.SetFolder(Item));
  Inc(FolderCount); Mode := 1; Timer.Enabled := True;
end;

procedure TDialogDriver.ConfirmShown(Sender: TObject);
begin Inc(ConfirmCount); Mode := 2; Timer.Enabled := True end;

procedure TDialogDriver.Tick(Sender: TObject);
var DialogWindow: HWND; WindowRect: TRect;
  Bitmap: TBitmap; PNG: TPngImage; DC: HDC;
begin
  if not Timer.Enabled then Exit;
  if Mode = 1 then begin
    DialogWindow := MainForm.LocalWebsiteFolderDialog.Handle;
    if DialogWindow = 0 then Exit;
    Timer.Enabled := False;
    PostMessage(DialogWindow, WM_COMMAND, IDOK, 0);
    Exit;
  end;
  Timer.Enabled := False;
  Mode := 0;
  DialogWindow := MainForm.LocalWebsiteConfirmDialog.Handle;
  GetWindowRect(DialogWindow, WindowRect);
  if WindowRect.Height > MaximumHeight then MaximumHeight := WindowRect.Height;
  { Native TaskDialog buttons are DirectUI elements, not GetDlgItem child HWNDs.
    The saved PNG is also inspected to verify both buttons remain visibly inside the window. }
  if (WindowRect.Height > 700) or not IsWindowVisible(DialogWindow) or
    not (tcbYes in MainForm.LocalWebsiteConfirmDialog.CommonButtons) or
    not (tcbNo in MainForm.LocalWebsiteConfirmDialog.CommonButtons) then
    Error := 'The expanded 100-file confirmation does not fit a 768px display.';
  Bitmap := TBitmap.Create; PNG := TPngImage.Create;
  try
    Bitmap.SetSize(WindowRect.Width, WindowRect.Height);
    SetWindowPos(DialogWindow, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE or SWP_NOSIZE or SWP_NOACTIVATE);
    RedrawWindow(DialogWindow, nil, 0, RDW_INVALIDATE or RDW_UPDATENOW or RDW_ALLCHILDREN);
    Sleep(50); { Let DirectUI composition finish before the task-owned window is captured. }
    DC := GetDC(0);
    try BitBlt(Bitmap.Canvas.Handle, 0, 0, Bitmap.Width, Bitmap.Height, DC, WindowRect.Left, WindowRect.Top, SRCCOPY)
    finally ReleaseDC(0, DC) end;
    PNG.Assign(Bitmap);
    PNG.SaveToFile(TPath.Combine(CaptureFolder, 'native-confirmation-' + IntToStr(ConfirmCount) + '.png'));
  finally PNG.Free; Bitmap.Free end;
  if AcceptRefresh and (Error = '') then PostMessage(DialogWindow, WM_USER + 102, IDYES, 0)
  else PostMessage(DialogWindow, WM_USER + 102, IDNO, 0); { TDM_CLICK_BUTTON }
end;

procedure Check(Condition: Boolean; const Description: string);
begin if not Condition then raise Exception.Create(Description); Writeln('PASS: ' + Description); Flush(Output) end;

procedure WaitTrue(const Script, Description: string; Timeout: Integer = 30000);
var Deadline: UInt64; Value: string;
begin
  Deadline := GetTickCount64 + UInt64(Timeout);
  repeat
    CheckSynchronize(0); Application.ProcessMessages; Sleep(20);
    Value := MainForm.EditorBrowser.ExecuteScript(Script, '');
  until (Value = 'true') or (GetTickCount64 >= Deadline);
  if Value <> 'true' then raise Exception.Create(Description + ' / ' + MainForm.StatusLabel.Caption);
  Check(True, Description);
end;

function CDP(const Method, Params: string): string;
var Handler: TDevToolsResult; Keep: ICoreWebView2CallDevToolsProtocolMethodCompletedHandler; Deadline: UInt64;
begin
  Handler := TDevToolsResult.Create; Keep := Handler;
  OleCheck(MainForm.EditorBrowser.DefaultInterface.CallDevToolsProtocolMethod(PChar(Method), PChar(Params), Keep));
  Deadline := GetTickCount64 + 10000;
  while not Handler.Done and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(10) end;
  if not Handler.Done or Winapi.Windows.Failed(Handler.Code) then raise Exception.Create('DevTools request failed.');
  Result := Handler.Data;
end;

procedure OpenFixture(const FileName: string);
var DocumentValue, Query, Answer, Params: TJSONObject; Files: TJSONArray; RootId, NodeId: Integer;
begin
  DocumentValue := TJSONObject.ParseJSONValue(CDP('DOM.getDocument', '{}')) as TJSONObject;
  try RootId := DocumentValue.GetValue<TJSONObject>('root').GetValue<Integer>('nodeId') finally DocumentValue.Free end;
  Query := TJSONObject.Create;
  try
    Query.AddPair('nodeId', TJSONNumber.Create(RootId)); Query.AddPair('selector', '[aria-label="Choose project file"]');
    Answer := TJSONObject.ParseJSONValue(CDP('DOM.querySelector', Query.ToJSON)) as TJSONObject;
    try NodeId := Answer.GetValue<Integer>('nodeId') finally Answer.Free end;
  finally Query.Free end;
  Check(NodeId <> 0, 'native project chooser found');
  Params := TJSONObject.Create;
  try
    Params.AddPair('nodeId', TJSONNumber.Create(NodeId)); Files := TJSONArray.Create; Files.Add(FileName); Params.AddPair('files', Files);
    CDP('DOM.setFileInputFiles', Params.ToJSON);
  finally Params.Free end;
  WaitTrue('Array.from(document.querySelectorAll("[role=status]")).some(e=>e.textContent.startsWith("Saved") && e.title.includes("maintenance.webstudio.json"))', 'synthetic project opened through native file bridge');
end;

procedure ClickButton(const Text: string);
var Json: TJSONString;
begin
  Json := TJSONString.Create(Text);
  try MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("button")).find(e=>e.textContent===' + Json.ToJSON + ')?.click()') finally Json.Free end;
end;

const Fixture = '{"format":"webstudio","schemaVersion":2,"projectId":"maintenance-native-fixture","settings":{"websiteTranslation":true},"config":{"name":"Community maintenance example","blocks":[{"id":"home-content","type":"content","variant":"prose","props":{"body":"# Welcome\nOriginal synthetic wording."}}],"pages":[{"id":"home","name":"Home","path":"/","blocks":[{"id":"home-content","type":"content","variant":"prose","props":{"body":"# Welcome\nOriginal synthetic wording."}}]},{"id":"visit","name":"Visit","path":"/community/visit","blocks":[{"id":"visit-content","type":"content","variant":"prose","props":{"body":"# Plan your visit\nOriginal synthetic wording."}}]}]},"assets":[]}';
var
  Folder, OpenFile, Original, SiteFolder, Relative, IniPath: string;
  Driver: TDialogDriver; Value, Page: TJSONObject; Pages: TJSONArray; Preferences: TMemIniFile;
  FolderPreferences: TStringList;
  Deadline: UInt64; CanClose: Boolean;
begin
  try
    Folder := ExtractFilePath(ParamStr(0));
    Check(LowerCase(Folder).Contains('.website-maintenance') and
      LowerCase(GetEnvironmentVariable('LOCALAPPDATA')).Contains('.website-maintenance'), 'disposable executable and isolated Windows profile required');
    OpenFile := TPath.Combine(Folder, 'maintenance.webstudio.json');
    SiteFolder := TPath.Combine(ExtractFileDir(ExcludeTrailingPathDelimiter(Folder)),
      'Local Site - ' + ExtractFileName(ExcludeTrailingPathDelimiter(Folder)));
    Check(not TFile.Exists(OpenFile) and not TDirectory.Exists(SiteFolder), 'fresh synthetic paths required');
    ForceDirectories(SiteFolder);
    Value := TJSONObject.ParseJSONValue(Fixture) as TJSONObject;
    try
      Pages := Value.GetValue<TJSONObject>('config').GetValue<TJSONArray>('pages');
      for var Index := 1 to 100 do begin
        Page := TJSONObject.ParseJSONValue(Pages.Items[1].ToJSON) as TJSONObject;
        Page.RemovePair('id').Free; Page.AddPair('id', 'additional-' + IntToStr(Index));
        Page.RemovePair('name').Free; Page.AddPair('name', 'Additional page ' + IntToStr(Index));
        var Block := Page.GetValue<TJSONArray>('blocks').Items[0] as TJSONObject;
        Block.RemovePair('id').Free; Block.AddPair('id', 'additional-content-' + IntToStr(Index));
        Relative := 'details/long-synthetic-page-address-for-testing-the-native-confirmation-file-list-' + Format('%.3d', [Index]);
        Page.RemovePair('path').Free; Page.AddPair('path', '/' + Relative);
        Pages.AddElement(Page);
        ForceDirectories(ExtractFileDir(TPath.Combine(SiteFolder, Relative.Replace('/', '\') + '.html')));
        TFile.WriteAllText(TPath.Combine(SiteFolder, Relative.Replace('/', '\') + '.html'), 'Old synthetic page');
      end;
      TFile.WriteAllText(OpenFile, Value.ToJSON, TEncoding.UTF8);
    finally Value.Free end;
    TFile.WriteAllText(TPath.Combine(SiteFolder, 'index.html'), 'Previous local website');
    TFile.WriteAllText(TPath.Combine(SiteFolder, 'private-notes.txt'), 'Preserve unrelated local notes.');
    Original := TFile.ReadAllText(OpenFile);
    Driver := TDialogDriver.Create;
    Driver.Folder := SiteFolder; Driver.CaptureFolder := Folder;
    Driver.Timer := TTimer.Create(nil); Driver.Timer.Enabled := False; Driver.Timer.Interval := 200; Driver.Timer.OnTimer := Driver.Tick;
    Application.Initialize; Application.ShowMainForm := False; Application.CreateForm(TMainForm, MainForm);
    try
      if ParamStr(1) = '--visible-check' then begin MainForm.Show; MainForm.BringToFront end;
      MainForm.LocalWebsiteFolderDialog.OnExecute := Driver.FolderShown;
      MainForm.LocalWebsiteConfirmDialog.OnDialogCreated := Driver.ConfirmShown;
      MainForm.LocalWebsiteConfirmDialog.Flags := MainForm.LocalWebsiteConfirmDialog.Flags + [tfExpandedByDefault];
      WaitTrue('!!document.querySelector("[data-project-command=open]")', 'native editor startup');
      OleCheck(MainForm.EditorBrowser.ControllerInterface.Set_IsVisible(1));
      OpenFixture(OpenFile);
      MainForm.EditorBrowser.ExecuteScript('location.hash="/deploy"');
      WaitTrue('Array.from(document.querySelectorAll("button")).some(e=>e.textContent==="Choose local test folder")', 'local test folder controls in native editor');
      ClickButton('Choose local test folder');
      WaitTrue('document.querySelector("[aria-label=\"Selected local test folder\"]")?.textContent.includes("Local Site")', 'native folder picker selected the dedicated folder');
      Check(Driver.FolderCount = 1, 'design-time Windows folder picker was used');
      IniPath := TPath.Combine(GetEnvironmentVariable('LOCALAPPDATA'), 'DelphiWebStudio\LocalSiteFolders.ini');
      Preferences := TMemIniFile.Create(IniPath);
      FolderPreferences := TStringList.Create;
      try
        Preferences.ReadSectionValues('Folders', FolderPreferences);
        Check((FolderPreferences.Count = 1) and (FolderPreferences.ValueFromIndex[0] = SiteFolder), 'per-project folder preference is native-only');
      finally FolderPreferences.Free; Preferences.Free end;
      MainForm.EditorBrowser.ExecuteScript('window.__maintenanceArms={};window.chrome.webview.addEventListener("message",function(e){if(e.data?.kind?.startsWith("site.local."))window.__maintenanceArms[e.data.token]=e.data;});window.__maintenanceSend=function(kind,token,projectId){window.chrome.webview.postMessage({version:1,kind,token,projectId:projectId||JSON.parse(localStorage.getItem("openpage-projects")).state.projects[0].id});};window.__maintenanceSend("site.local.prepare","11111111-1111-4111-8111-111111111111")');
      WaitTrue('window.__maintenanceArms["11111111-1111-4111-8111-111111111111"]?.kind==="site.local.ready"', 'native refresh preparation armed');
      MainForm.EditorBrowser.ExecuteScript('window.__maintenanceSend("site.local.cancel","22222222-2222-4222-8222-222222222222");window.__maintenanceSend("site.local.cancel","11111111-1111-4111-8111-111111111111","other-project");window.__maintenanceSend("site.local.prepare","33333333-3333-4333-8333-333333333333")');
      WaitTrue('window.__maintenanceArms["33333333-3333-4333-8333-333333333333"]?.ok===false', 'wrong token or project cannot release another preparation');
      MainForm.EditorBrowser.ExecuteScript('window.__maintenanceSend("site.local.cancel","11111111-1111-4111-8111-111111111111")');
      WaitTrue('window.__maintenanceArms["11111111-1111-4111-8111-111111111111"]?.cancelled===true', 'matching cancellation releases only its own unused preparation');
      MainForm.EditorBrowser.ExecuteScript('window.__maintenanceSend("site.local.prepare","44444444-4444-4444-8444-444444444444")');
      WaitTrue('window.__maintenanceArms["44444444-4444-4444-8444-444444444444"]?.kind==="site.local.ready"', 'another refresh can start after cancellation');
      MainForm.EditorBrowser.ExecuteScript('window.__maintenanceSend("site.local.cancel","44444444-4444-4444-8444-444444444444")');
      WaitTrue('window.__maintenanceArms["44444444-4444-4444-8444-444444444444"]?.cancelled===true', 'synthetic preparation cleaned up before real export');
      ClickButton('Review files');
      WaitTrue('document.querySelector("[aria-label=\"Website files\"]")?.textContent.includes("assets/translation-selector.js")', 'reviewed export contains translation');
      Driver.AcceptRefresh := False;
      ClickButton('Refresh local site');
      Deadline := GetTickCount64 + 60000;
      while (MainForm.StatusLabel.Caption <> 'Local site refresh cancelled; files were not changed.') and (GetTickCount64 < Deadline) do begin
        CheckSynchronize(0); Application.ProcessMessages; Sleep(20);
      end;
      Check(MainForm.StatusLabel.Caption = 'Local site refresh cancelled; files were not changed.', 'native refresh cancellation completed: ' + MainForm.StatusLabel.Caption);
      WaitTrue('Array.from(document.querySelectorAll("button")).some(e=>e.textContent==="Refresh local site" && !e.disabled)', 'cancelled native refresh returned to the editor');
      Check(Driver.ConfirmCount = 1, 'first-use overwrite confirmation shown');
      Check(TFile.ReadAllText(TPath.Combine(SiteFolder, 'index.html')) = 'Previous local website', 'No preserves the older local website');
      Driver.AcceptRefresh := True;
      ClickButton('Refresh local site');
      Deadline := GetTickCount64 + 60000;
      while (MainForm.StatusLabel.Caption <> 'Local website files refreshed. Choose Open local site to test them.') and (GetTickCount64 < Deadline) do begin
        CheckSynchronize(0); Application.ProcessMessages; Sleep(20);
      end;
      Check(MainForm.StatusLabel.Caption = 'Local website files refreshed. Choose Open local site to test them.', 'native reviewed-ZIP download and refresh completed');
      Check(Driver.Error = '', 'confirmation controls remain visible: ' + Driver.Error);
      Check(Driver.MaximumHeight <= 700, 'expanded 100-file confirmation fits a 768px display');
      Check(TFile.Exists(TPath.Combine(SiteFolder, 'assets\translation-selector.js')) and
        TFile.ReadAllText(TPath.Combine(SiteFolder, 'index.html')).Contains('Original synthetic wording'), 'ordinary index, assets and nested pages written');
      Check(TFile.ReadAllText(TPath.Combine(SiteFolder, 'private-notes.txt')) = 'Preserve unrelated local notes.', 'unmanaged local notes remain intact');
      MainForm.EditorBrowser.ExecuteScript('location.hash="/editor"');
      WaitTrue('!!document.querySelector("[data-project-command=save]")', 'returned to editor');
      MainForm.EditorBrowser.ExecuteScript('location.hash="/deploy"');
      WaitTrue('document.querySelector("[aria-label=\"Selected local test folder\"]")?.textContent.includes("Local Site")', 'folder preference reloaded after navigation');
      MainForm.EditorBrowser.ExecuteScript('window.__maintenanceLinks=null;window.chrome.webview.addEventListener("message",function(e){if(e.data?.token==="11111111-1111-4111-8111-111111111111"&&e.data.kind==="site.links.result")window.__maintenanceLinks=e.data;});window.chrome.webview.postMessage({version:1,kind:"site.links.check",token:"11111111-1111-4111-8111-111111111111",urls:["https://www.w3.org/","https://www.w3.org/this-path-does-not-exist-webstudio-check","http://127.0.0.1/"]})');
      WaitTrue('window.__maintenanceLinks?.ok===true && window.__maintenanceLinks.results.length===3', 'real native external-link protocol returned results', 90000);
      WaitTrue('window.__maintenanceLinks.results[0].status==="ok" && window.__maintenanceLinks.results[1].status==="broken" && window.__maintenanceLinks.results[2].status==="blocked"', 'native link checker distinguishes live, missing and private destinations');
      Check(TFile.ReadAllText(OpenFile) = Original, 'saved synthetic project untouched by export and checking');
      CanClose := False; MainForm.FormCloseQuery(nil, CanClose);
      Check(CanClose, 'project remains saved after local export');
      Writeln('PASS: native maintenance acceptance completed; maximum confirmation height=' + IntToStr(Driver.MaximumHeight));
    finally MainForm.Free; Driver.Timer.Free; Driver.Free end;
  except on E: Exception do begin Writeln('FAIL: ' + E.Message); ExitCode := 1 end end;
end.
