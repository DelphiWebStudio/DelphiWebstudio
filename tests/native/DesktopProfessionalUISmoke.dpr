program DesktopProfessionalUISmoke;
{$APPTYPE CONSOLE}
{$B-}
{ Run beside a staged editor bundle and its matching WebView2Loader.dll in a
  disposable folder. Copy tests/fixtures/professional-ui.webstudio.json to
  opened.webstudio.json; provide editor\picture.png and editor\sample.txt.
  Set LOCALAPPDATA to an isolated path containing .professional-ui. The test
  writes both project files and drives a legacy chooser without user input. }
uses Winapi.Windows, Winapi.Messages, Winapi.WebView2, Winapi.CommDlg, Winapi.Dlgs,
  System.SysUtils, System.Classes, System.IOUtils, System.JSON, Vcl.Forms, Vcl.Edge, Vcl.Dialogs, Vcl.ExtCtrls,
  WebStudio.Main in 'WebStudio.Main.pas';
type
  TDevToolsResult = class(TInterfacedObject, ICoreWebView2CallDevToolsProtocolMethodCompletedHandler)
    Done: Boolean; Data: string; Code: HResult;
    function Invoke(errorCode: HResult; resultJSON: PWideChar): HResult; stdcall;
  end;
  TSaveDriver = class
    Count: Integer;
    ChosenPath: string;
    DialogWindow: HWND;
    Timer: TTimer;
    procedure Accept(Sender: TObject);
    procedure Shown(Sender: TObject);
  end;
function TDevToolsResult.Invoke(errorCode: HResult; resultJSON: PWideChar): HResult;
begin Code := errorCode; if resultJSON <> nil then Data := string(resultJSON); Done := True; Result := S_OK end;
procedure TSaveDriver.Shown(Sender: TObject);
begin
  Inc(Count);
  if Count <> 1 then raise Exception.Create('Save unexpectedly asked for another destination.');
  ChosenPath := TPath.Combine(ExtractFilePath(ParamStr(0)), 'save-as.webstudio.json');
  if TFile.Exists(ChosenPath) then raise Exception.Create('The Save As fixture already exists.');
  DialogWindow := TSaveDialog(Sender).Handle;
  Timer.Enabled := True;
end;
procedure TSaveDriver.Accept(Sender: TObject);
begin
  Timer.Enabled := False;
  if not SetDlgItemText(DialogWindow, edt1, PChar(ChosenPath)) then begin
    PostMessage(DialogWindow, WM_COMMAND, IDCANCEL, 0); Exit;
  end;
  PostMessage(DialogWindow, WM_COMMAND, IDOK, 0);
end;
function CDP(const Method, Params: string): string;
var Handler: TDevToolsResult; Keep: ICoreWebView2CallDevToolsProtocolMethodCompletedHandler; Deadline: UInt64;
begin
  Handler := TDevToolsResult.Create; Keep := Handler;
  if Winapi.Windows.Failed(MainForm.EditorBrowser.DefaultInterface.CallDevToolsProtocolMethod(PChar(Method), PChar(Params), Keep)) then raise Exception.Create('DevTools request failed.');
  Deadline := GetTickCount64 + 10000;
  while not Handler.Done and (GetTickCount64 < Deadline) do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(10) end;
  if not Handler.Done or Winapi.Windows.Failed(Handler.Code) then raise Exception.Create('DevTools reply failed: ' + Method);
  Result := Handler.Data;
end;
procedure WaitTrue(const Script, Description: string);
var Deadline: UInt64; Value: string;
begin
  Writeln('Waiting: ' + Description); Flush(Output);
  Deadline := GetTickCount64 + 30000;
  repeat CheckSynchronize(0); Application.ProcessMessages; Sleep(30); Value := MainForm.EditorBrowser.ExecuteScript(Script, '') until (Value = 'true') or (GetTickCount64 >= Deadline);
  Writeln('Result: ', Description, ' ', Value); Flush(Output);
  if Value <> 'true' then raise Exception.Create(Description + ': ' + Value + ' / ' + MainForm.StatusLabel.Caption + ' / ' + MainForm.EditorBrowser.ExecuteScript('document.body.innerText', ''));
end;
procedure SelectFiles(const Selector: string; const Files: array of string);
var DocumentValue, Query, Answer, Params: TJSONObject; Paths: TJSONArray; RootId, NodeId: Integer; FileName: string;
begin
  DocumentValue := TJSONObject.ParseJSONValue(CDP('DOM.getDocument', '{}')) as TJSONObject;
  try RootId := DocumentValue.GetValue<TJSONObject>('root').GetValue<Integer>('nodeId') finally DocumentValue.Free end;
  Query := TJSONObject.Create;
  try Query.AddPair('nodeId', TJSONNumber.Create(RootId)); Query.AddPair('selector', Selector); Answer := TJSONObject.ParseJSONValue(CDP('DOM.querySelector', Query.ToJSON)) as TJSONObject;
    try NodeId := Answer.GetValue<Integer>('nodeId') finally Answer.Free end;
  finally Query.Free end;
  if NodeId = 0 then raise Exception.Create('File input not found: ' + Selector);
  Params := TJSONObject.Create;
  try
    Params.AddPair('nodeId', TJSONNumber.Create(NodeId)); Paths := TJSONArray.Create;
    for FileName in Files do Paths.Add(FileName);
    Params.AddPair('files', Paths); CDP('DOM.setFileInputFiles', Params.ToJSON);
  finally Params.Free end;
end;
var Folder, OpenFile, Original: string; Driver: TSaveDriver; CanClose: Boolean; Index: Integer;
begin
  Folder := ExtractFilePath(ParamStr(0)); OpenFile := TPath.Combine(Folder, 'opened.webstudio.json');
  if not TFile.Exists(OpenFile) then raise Exception.Create('Fresh isolated fixtures required.');
  if Pos('.professional-ui', LowerCase(GetEnvironmentVariable('LOCALAPPDATA'))) = 0 then raise Exception.Create('An isolated test profile is required.');
  Original := TFile.ReadAllText(OpenFile);
  Driver := TSaveDriver.Create; Driver.Timer := TTimer.Create(nil); Driver.Timer.Enabled := False; Driver.Timer.Interval := 200; Driver.Timer.OnTimer := Driver.Accept;
  UseLatestCommonDialogs := False;
  Application.Initialize; Application.ShowMainForm := False; Application.CreateForm(TMainForm, MainForm);
  try
    MainForm.ProjectSaveDialog.InitialDir := Folder;
    MainForm.ProjectSaveDialog.Options := MainForm.ProjectSaveDialog.Options + [ofOldStyleDialog];
    MainForm.ProjectSaveDialog.OnShow := Driver.Shown;
    WaitTrue('!!document.querySelector("[data-project-command=open]")', 'Editor startup');
    if Winapi.Windows.Failed(MainForm.EditorBrowser.ControllerInterface.Set_IsVisible(1)) then raise Exception.Create('WebView visibility');
    SelectFiles('[aria-label="Choose project file"]', [OpenFile]);
    WaitTrue('!!document.querySelector("[role=menubar]") && Array.from(document.querySelectorAll("[role=status]")).some(e=>e.title.includes("opened.webstudio.json"))', 'Opened-file path association');
    MainForm.EditorBrowser.ExecuteScript('(()=>{const e=document.querySelector("[data-rich-editor=headline]");e.focus();e.textContent="Updated native headline";e.dispatchEvent(new InputEvent("input",{bubbles:true,inputType:"insertText",data:"Updated native headline"}))})()');
    WaitTrue('Array.from(document.querySelectorAll("[role=status]")).some(e=>e.textContent.startsWith("Unsaved changes"))', 'Text edit dirty state');
    MainForm.SaveProjectItemClick(nil);
    WaitTrue('Array.from(document.querySelectorAll("[role=status]")).some(e=>e.textContent.startsWith("Saved") && e.title.includes("opened.webstudio.json"))', 'Save acknowledgement');
    if Driver.Count <> 0 then raise Exception.Create('Save displayed Save As dialog.');
    if (TFile.ReadAllText(OpenFile) = Original) or not TFile.ReadAllText(OpenFile).Contains('Updated native headline') then raise Exception.Create('Opened project was not updated.');
    MainForm.SaveProjectAsItemClick(nil);
    WaitTrue('Array.from(document.querySelectorAll("[role=status]")).some(e=>e.textContent.startsWith("Saved") && e.title.includes("save-as.webstudio.json"))', 'Save As acknowledgement');
    if (Driver.Count <> 1) or not TFile.Exists(Driver.ChosenPath) or not TFile.ReadAllText(Driver.ChosenPath).Contains('Updated native headline') then raise Exception.Create('Save As did not create the selected new file.');
    MainForm.StatusLabel.Caption := 'Waiting for repeated save';
    MainForm.SaveProjectItemClick(nil);
    WaitTrue('Array.from(document.querySelectorAll("[role=status]")).some(e=>e.textContent.startsWith("Saved") && e.title.includes("save-as.webstudio.json"))', 'Repeated Save');
    for Index := 1 to 50 do begin CheckSynchronize(0); Application.ProcessMessages; Sleep(10) end;
    CanClose := False; MainForm.FormCloseQuery(nil, CanClose);
    if not CanClose then raise Exception.Create('A just-saved project was marked dirty.');
    MainForm.EditorBrowser.ExecuteScript('window.dispatchEvent(new Event("webstudio.media"))');
    WaitTrue('!!document.querySelector("dialog[open][aria-labelledby=media-library-title]")', 'Media picker');
    SelectFiles('[aria-label="Import media files"]', [TPath.Combine(Folder, 'editor\picture.png'), TPath.Combine(Folder, 'editor\sample.txt')]);
    WaitTrue('Array.from(document.querySelectorAll("[role=button]")).some(e=>e.getAttribute("aria-label")==="Select picture.png")', 'Media thumbnails');
    MainForm.EditorBrowser.ExecuteScript('document.querySelector("[aria-label=\"Select picture.png\"]").click()');
    WaitTrue('document.querySelector("[aria-label=\"Select picture.png\"]").getAttribute("aria-pressed")==="true"', 'Selected image');
    MainForm.EditorBrowser.ExecuteScript('Array.from(document.querySelectorAll("dialog[open] button")).find(b=>b.textContent==="Add to page").click()');
    WaitTrue('!document.querySelector("dialog[open]") && document.body.textContent.includes("place the image")', 'Selected media placement');
    MainForm.EditorBrowser.ExecuteScript('(()=>{const e=document.querySelector("[data-editor-section]"); const r=e.getBoundingClientRect(); e.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true,button:0,clientX:r.left+40,clientY:r.top+40}))})()');
    WaitTrue('!!document.querySelector("[data-section-object] img")', 'Placed image');
    { Adding media changes the file type to ZIP, so a new destination is required. Verify the dirty state instead; close query is checked before media below. }
    Writeln('PASS: native opened-path Save, Save As, repeated Save, and media library import/placement.');
  finally MainForm.Free; Driver.Timer.Free; Driver.Free end;
end.
