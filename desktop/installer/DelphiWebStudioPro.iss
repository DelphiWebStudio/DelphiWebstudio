#ifndef StageDir
  #error StageDir must point to a verified desktop preview folder
#endif
#if !FileExists(StageDir + "\editor\index.html")
  #error StageDir must contain the staged editor index
#endif
#ifndef AppBuildVersion
  #define AppBuildVersion "0.1.0"
#endif

[Setup]
AppId={{6C0E2605-2CF1-4623-B1F9-2C0D7F79D75F}
AppName=Delphi Web Studio Pro (Experimental)
AppVersion={#AppBuildVersion}
AppPublisher=Delphi Web Studio Pro contributors
DefaultDirName={localappdata}\Programs\Delphi Web Studio Pro Experimental
DefaultGroupName=Delphi Web Studio Pro (Experimental)
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
OutputBaseFilename=DelphiWebStudioPro-Experimental-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
LicenseFile=..\..\LICENSE
InfoBeforeFile=INSTALL-NOTES.txt
UninstallDisplayIcon={app}\DelphiWebStudioPro.exe
CloseApplications=no
RestartApplications=no

[Files]
Source: "{#StageDir}\DelphiWebStudioPro.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#StageDir}\WebView2Loader.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#StageDir}\editor\*"; DestDir: "{app}\editor"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\LICENSE"; DestDir: "{app}"; DestName: "LICENSE.txt"; Flags: ignoreversion
Source: "..\..\THIRD_PARTY_NOTICES.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\docs\PRIVACY.md"; DestDir: "{app}\docs"; Flags: ignoreversion
Source: "..\..\docs\RECOVERY.md"; DestDir: "{app}\docs"; Flags: ignoreversion
Source: "..\..\docs\THIRD_PARTY_LICENSE_TEXTS.txt"; DestDir: "{app}\docs"; Flags: ignoreversion
Source: "..\..\docs\WEBVIEW2_SDK_LICENSE.txt"; DestDir: "{app}\docs"; Flags: ignoreversion

[Icons]
Name: "{group}\Delphi Web Studio Pro (Experimental)"; Filename: "{app}\DelphiWebStudioPro.exe"

[Code]
function InitializeSetup: Boolean;
var
  Version: String;
  ErrorCode: Integer;
begin
  Result := RegQueryStringValue(HKLM32,
    'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', Version)
    and (Trim(Version) <> '') and (Trim(Version) <> '0.0.0.0');
  if not Result then
    Result := RegQueryStringValue(HKCU,
      'Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', Version)
      and (Trim(Version) <> '') and (Trim(Version) <> '0.0.0.0');
  if not Result then begin
    if WizardSilent then
      Log('Microsoft Edge WebView2 Runtime is required. Install the Evergreen Runtime before running Setup.')
    else if MsgBox('Microsoft Edge WebView2 Runtime is required. Open the Microsoft download page? Install the Evergreen Runtime, then run Setup again.', mbConfirmation, MB_YESNO) = IDYES then
      if not ShellExec('open', 'https://developer.microsoft.com/microsoft-edge/webview2/', '', '', SW_SHOWNORMAL, ewNoWait, ErrorCode) then
        MsgBox('Could not open the browser. Get the Evergreen Runtime from Microsoft, then run Setup again.', mbError, MB_OK);
  end;
end;
