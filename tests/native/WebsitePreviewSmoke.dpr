program WebsitePreviewSmoke;

{$APPTYPE CONSOLE}

uses
  System.SysUtils, System.IOUtils, System.Classes, System.Zip, IdHTTP,
  WebStudio.WebsitePreview in '..\..\desktop\project\WebStudio.WebsitePreview.pas';

var
  ArchivePath, Root: string;
  Archive: TZipFile;
  Preview: TWebsitePreview;
  Client: TIdHTTP;
  Token: TGUID;
  Rejected: Boolean;
begin
  CreateGUID(Token);
  ArchivePath := TPath.Combine(TPath.GetTempPath, 'webstudio-preview-test-' + GUIDToString(Token) + '.zip');
  try
    Archive := TZipFile.Create;
    try
      Archive.Open(ArchivePath, zmWrite);
      Archive.Add(TEncoding.UTF8.GetBytes('<h1>Exact export</h1>'), 'index.html');
      Archive.Add(TEncoding.UTF8.GetBytes('<p>Nested export</p>'), 'about/history.html');
      Archive.Add(TEncoding.UTF8.GetBytes('%PDF-example'), 'assets/sample.pdf');
    finally Archive.Free end;
    Preview := TWebsitePreview.Create(ArchivePath, 'test-token');
    try
      Client := TIdHTTP.Create(nil);
      try
        Client.ConnectTimeout := 3000;
        Client.ReadTimeout := 3000;
        Root := Copy(Preview.Address, 1, Length(Preview.Address) - Length('index.html'));
        if Client.Get(Preview.Address) <> '<h1>Exact export</h1>' then
          raise Exception.Create('Index bytes changed.');
        if Client.Get(Root + 'about/history.html') <> '<p>Nested export</p>' then
          raise Exception.Create('Nested page bytes changed.');
        if Client.Get(Root + 'assets/sample.pdf') <> '%PDF-example' then
          raise Exception.Create('PDF bytes changed.');
        if Client.Response.ContentType <> 'application/pdf' then
          raise Exception.Create('PDF content type was incorrect.');
        if Pos('form-action', Client.Response.RawHeaders.Values['Content-Security-Policy']) = 0 then
          raise Exception.Create('Preview form protection is missing.');
        Rejected := False;
        try Client.Get(StringReplace(Preview.Address, '/test-token/', '/wrong/', []))
        except on E: EIdHTTPProtocolException do Rejected := E.ErrorCode = 404 end;
        if not Rejected then raise Exception.Create('An incorrect token could access the preview.');
      finally Client.Free end;
    finally Preview.Free end;
    if TFile.Exists(ArchivePath) then raise Exception.Create('Preview archive was retained.');
    Writeln('Website preview smoke passed.');
  finally
    if TFile.Exists(ArchivePath) then TFile.Delete(ArchivePath);
  end;
end.
