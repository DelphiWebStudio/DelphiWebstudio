unit WebStudio.WebsitePreview;

interface

uses System.Classes, System.Zip, IdContext, IdHTTPServer, IdCustomHTTPServer;

type
  TWebsitePreview = class
  private
    FServer: TIdHTTPServer;
    FArchive: TZipFile;
    FFile: THandleStream;
    FHandle: THandle;
    FPrefix: string;
    FHost: string;
    procedure Serve(Context: TIdContext; Request: TIdHTTPRequestInfo;
      Response: TIdHTTPResponseInfo);
  public
    constructor Create(const FileName, Token: string);
    destructor Destroy; override;
    function Address: string;
  end;

implementation

uses Winapi.Windows, System.SysUtils, System.IOUtils, IdGlobal;

constructor TWebsitePreview.Create(const FileName, Token: string);
begin
  inherited Create;
  FHandle := CreateFile(PChar(FileName), GENERIC_READ or _DELETE, FILE_SHARE_READ or FILE_SHARE_DELETE,
    nil, OPEN_EXISTING, FILE_FLAG_DELETE_ON_CLOSE, 0);
  if FHandle = INVALID_HANDLE_VALUE then RaiseLastOSError;
  FFile := THandleStream.Create(FHandle);
  FArchive := TZipFile.Create;
  FArchive.Open(FFile, zmRead);
  if (FArchive.FileCount > 10000) or (FArchive.IndexOf('index.html') < 0) then
    raise EArgumentException.Create('The preview package must contain a website index.');
  FPrefix := '/' + Token + '/';
  FServer := TIdHTTPServer.Create(nil);
  FServer.DefaultPort := 0;
  FServer.MaxConnections := 16;
  FServer.KeepAlive := False;
  with FServer.Bindings.Add do begin
    IPVersion := Id_IPv4;
    IP := '127.0.0.1';
    Port := 0;
  end;
  FServer.OnCommandGet := Serve;
  FServer.OnCommandOther := Serve;
  FServer.Active := True;
  FHost := '127.0.0.1:' + IntToStr(FServer.Bindings[0].Port);
end;

destructor TWebsitePreview.Destroy;
begin
  FServer.Free;
  FArchive.Free;
  FFile.Free;
  if (FHandle <> 0) and (FHandle <> INVALID_HANDLE_VALUE) then CloseHandle(FHandle);
  inherited;
end;

function TWebsitePreview.Address: string;
begin
  Result := 'http://' + FHost + FPrefix + 'index.html';
end;

procedure TWebsitePreview.Serve(Context: TIdContext; Request: TIdHTTPRequestInfo;
  Response: TIdHTTPResponseInfo);
var
  FileName, Extension: string;
  Index: Integer;
  Bytes: TBytes;
  Header: TZipHeader;
begin
  Response.ResponseNo := 404;
  Response.CustomHeaders.Values['Cache-Control'] := 'no-store';
  Response.CustomHeaders.Values['X-Content-Type-Options'] := 'nosniff';
  Response.CustomHeaders.Values['Referrer-Policy'] := 'no-referrer';
  Response.CustomHeaders.Values['Content-Security-Policy'] :=
    'form-action ''none''; connect-src ''self''; frame-ancestors ''self''';
  if not SameText(Request.RawHeaders.Values['Host'], FHost) or
    not Request.Document.StartsWith(FPrefix) then Exit;
  if (Request.Command <> 'GET') and (Request.Command <> 'HEAD') then begin
    Response.ResponseNo := 405;
    Exit;
  end;
  FileName := Copy(Request.Document, Length(FPrefix) + 1, MaxInt);
  if FileName = '' then FileName := 'index.html';
  for var Segment in FileName.Split(['/']) do
    if (Segment = '') or (Segment = '.') or (Segment = '..') or Segment.Contains('\') then Exit;
  Extension := LowerCase(TPath.GetExtension(FileName));
  if Extension = '.html' then Response.ContentType := 'text/html; charset=utf-8'
  else if Extension = '.css' then Response.ContentType := 'text/css; charset=utf-8'
  else if (Extension = '.js') or (Extension = '.mjs') then Response.ContentType := 'text/javascript; charset=utf-8'
  else if Extension = '.pdf' then Response.ContentType := 'application/pdf'
  else if Extension = '.png' then Response.ContentType := 'image/png'
  else if (Extension = '.jpg') or (Extension = '.jpeg') then Response.ContentType := 'image/jpeg'
  else if Extension = '.webp' then Response.ContentType := 'image/webp'
  else if Extension = '.gif' then Response.ContentType := 'image/gif'
  else if Extension = '.avif' then Response.ContentType := 'image/avif'
  else if Extension = '.svg' then Response.ContentType := 'image/svg+xml'
  else if Extension = '.mp4' then Response.ContentType := 'video/mp4'
  else if Extension = '.webm' then Response.ContentType := 'video/webm'
  else if Extension = '.mp3' then Response.ContentType := 'audio/mpeg'
  else if Extension = '.wav' then Response.ContentType := 'audio/wav'
  else if Extension = '.xml' then Response.ContentType := 'application/xml'
  else Response.ContentType := 'application/octet-stream';
  TMonitor.Enter(FArchive);
  try
    Index := FArchive.IndexOf(FileName);
    if (Index < 0) or (FArchive.FileName[Index] <> FileName) then Exit;
    Header := FArchive.FileInfo[Index];
    if Header.IsEncrypted or (Header.UncompressedSize64 > 256 * 1024 * 1024) then Exit;
    if Request.Command = 'GET' then begin
      FArchive.Read(Index, Bytes);
      Response.ContentStream := TBytesStream.Create(Bytes);
      Response.FreeContentStream := True;
    end;
    Response.ContentLength := Header.UncompressedSize64;
    Response.ResponseNo := 200;
  finally
    TMonitor.Exit(FArchive);
  end;
end;

end.
