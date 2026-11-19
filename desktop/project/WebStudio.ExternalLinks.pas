unit WebStudio.ExternalLinks;
{$POINTERMATH ON}

interface

uses System.SysUtils, System.JSON;

function CheckExternalLinks(const Urls: TArray<string>): string;

implementation

uses Winapi.Windows, Winapi.WinHttp, Winapi.Winsock2, Winapi.Shlwapi, System.Classes,
  System.SyncObjs, System.Threading, System.RegularExpressions, System.Math;

type ELinkBlocked = class(EArgumentException);
  PLinkAddrInfoEx = ^TLinkAddrInfoEx;
  TLinkAddrInfoEx = record
    Flags, Family, SocketType, Protocol: Integer;
    AddressLength: NativeUInt;
    CanonicalName: PWideChar;
    Address: PSockAddr;
    Blob: Pointer;
    BlobLength: NativeUInt;
    Provider: PGUID;
    Next: PLinkAddrInfoEx;
  end;
  PLinkDnsContext = ^TLinkDnsContext;
  TLinkDnsContext = record
    Overlapped: TOverlapped;
    References: Integer;
    Event, NameHandle: THandle;
    ErrorCode: DWORD;
    WinsockStarted: Boolean;
    Addresses: PLinkAddrInfoEx;
    Host: string;
    Hints: TLinkAddrInfoEx;
    Timeout: TTimeVal;
  end;

{ These two Windows 10 APIs are absent from this RAD Studio Winsock unit.
  The declarations follow the Windows SDK ADDRINFOEXW/GetAddrInfoExW layout. }
function GetAddrInfoExW(Name, Service: PWideChar; Namespace: DWORD; Provider: PGUID;
  Hints: PLinkAddrInfoEx; out Results: PLinkAddrInfoEx; Timeout: PTimeVal;
  Overlapped, CompletionRoutine, NameHandle: Pointer): Integer; stdcall; external 'ws2_32.dll';
procedure FreeAddrInfoExW(Results: PLinkAddrInfoEx); stdcall; external 'ws2_32.dll';
function GetAddrInfoExCancel(NameHandle: PHandle): Integer; stdcall; external 'ws2_32.dll';

const WINHTTP_OPTION_RESOLUTION_HOSTNAME = 165; { Windows SDK winhttp.h; TLS still uses the original host. }

procedure ReleaseDns(Context: PLinkDnsContext);
begin
  if TInterlocked.Decrement(Context.References) = 0 then begin
    if Context.Addresses <> nil then FreeAddrInfoExW(Context.Addresses);
    if Context.Event <> 0 then CloseHandle(Context.Event);
    if Context.WinsockStarted then WSACleanup;
    Dispose(Context);
  end;
end;

procedure NameResolved(ErrorCode, Bytes: DWORD; Overlapped: POverlapped); stdcall;
var Context: PLinkDnsContext;
begin
  Context := PLinkDnsContext(Overlapped);
  Context.ErrorCode := ErrorCode;
  SetEvent(Context.Event);
  ReleaseDns(Context);
end;

function PublicAddress(Address: PSockAddr; Family: Integer): Boolean;
var Bytes: PByte;
begin
  Result := False;
  if Family = AF_INET then begin
    Bytes := PByte(NativeUInt(Address) + 4);
    if (Bytes[0] = 0) or (Bytes[0] = 10) or (Bytes[0] = 127) or (Bytes[0] >= 224) or
      ((Bytes[0] = 100) and (Bytes[1] >= 64) and (Bytes[1] <= 127)) or
      ((Bytes[0] = 169) and (Bytes[1] = 254)) or
      ((Bytes[0] = 172) and (Bytes[1] >= 16) and (Bytes[1] <= 31)) or
      ((Bytes[0] = 192) and ((Bytes[1] = 0) or (Bytes[1] = 168))) or
      ((Bytes[0] = 198) and ((Bytes[1] = 18) or (Bytes[1] = 19) or ((Bytes[1] = 51) and (Bytes[2] = 100)))) or
      ((Bytes[0] = 203) and (Bytes[1] = 0) and (Bytes[2] = 113)) then Exit;
    Result := True;
  end else if Family = AF_INET6 then begin
    Bytes := PByte(NativeUInt(Address) + 8);
    Result := ((Bytes[0] and $e0) = $20) and
      not ((Bytes[0] = $20) and (Bytes[1] = $02)) and
      not ((Bytes[0] = $20) and (Bytes[1] = $01) and
        (((Bytes[2] = $0d) and (Bytes[3] = $b8)) or ((Bytes[2] = 0) and (Bytes[3] = 0))));
  end;
end;

procedure ValidateAddress(const Url: string; out Host, Resource, NumericAddress: string; out Port: Word; out Secure: Boolean; Deadline: UInt64);
var Parts: TURLComponents; Addresses, Current, Preferred: PLinkAddrInfoEx;
  AddressText: array[0..127] of WideChar; AddressLength: DWORD;
  Remaining, DnsCode: Integer; Context: PLinkDnsContext; Startup: TWSAData;
begin
  if (Length(Url) > 2048) or TRegEx.IsMatch(Url, '[\x00-\x20\\]') or
    not TRegEx.IsMatch(Url, '^https?://', [roIgnoreCase]) or
    TRegEx.IsMatch(Url, '^https?://[^/?#]*@', [roIgnoreCase]) then
    raise ELinkBlocked.Create('Only ordinary HTTP or HTTPS website links can be checked.');
  FillChar(Parts, SizeOf(Parts), 0); Parts.dwStructSize := SizeOf(Parts);
  Parts.dwHostNameLength := DWORD(-1); Parts.dwUrlPathLength := DWORD(-1);
  Parts.dwExtraInfoLength := DWORD(-1); Parts.dwUserNameLength := DWORD(-1); Parts.dwPasswordLength := DWORD(-1);
  if not WinHttpCrackUrl(PChar(Url), Length(Url), 0, Parts) or
    (Parts.dwUserNameLength <> 0) or (Parts.dwPasswordLength <> 0) or
    not (Parts.nScheme in [INTERNET_SCHEME_HTTP, INTERNET_SCHEME_HTTPS]) then
    raise ELinkBlocked.Create('This address cannot be checked safely.');
  SetString(Host, Parts.lpszHostName, Parts.dwHostNameLength);
  Host := Host.Trim(['[', ']']);
  if not Host.Contains('.') and not Host.Contains(':') then
    raise ELinkBlocked.Create('Local computer names are not checked.');
  Secure := Parts.nScheme = INTERNET_SCHEME_HTTPS;
  Port := Parts.nPort;
  if (Secure and (Port <> 443)) or (not Secure and (Port <> 80)) then
    raise ELinkBlocked.Create('Only the standard HTTP and HTTPS ports are checked.');
  SetString(Resource, Parts.lpszUrlPath, Parts.dwUrlPathLength);
  if Resource = '' then Resource := '/';
  if Parts.dwExtraInfoLength > 0 then begin
    var Extra: string; SetString(Extra, Parts.lpszExtraInfo, Parts.dwExtraInfoLength);
    if Extra.Contains('#') then Extra := Copy(Extra, 1, Extra.IndexOf('#'));
    Resource := Resource + Extra;
  end;
  Remaining := Min(1500, Int64(Deadline) - Int64(GetTickCount64));
  if Remaining <= 0 then raise EInvalidOpException.Create('The link check reached its time limit.');
  New(Context);
  FillChar(Context.Overlapped, SizeOf(Context.Overlapped), 0);
  FillChar(Context.Hints, SizeOf(Context.Hints), 0);
  Context.Addresses := nil; Context.References := 1; Context.NameHandle := 0;
  Context.Event := CreateEvent(nil, True, False, nil);
  Context.WinsockStarted := False;
  Context.Host := Host;
  Context.Timeout.tv_sec := Remaining div 1000; Context.Timeout.tv_usec := (Remaining mod 1000) * 1000;
  Context.Hints.Family := AF_UNSPEC; Context.Hints.SocketType := SOCK_STREAM; Context.Hints.Protocol := IPPROTO_TCP;
  try
    if Context.Event = 0 then RaiseLastOSError;
    if WSAStartup($0202, Startup) <> 0 then raise EInvalidOpException.Create('Windows networking is unavailable.');
    Context.WinsockStarted := True;
    TInterlocked.Increment(Context.References); { The completion callback owns the second reference. }
    DnsCode := GetAddrInfoExW(PChar(Context.Host), nil, NS_DNS, nil, @Context.Hints,
      Context.Addresses, @Context.Timeout, @Context.Overlapped, @NameResolved, @Context.NameHandle);
    if DnsCode <> WSA_IO_PENDING then NameResolved(DnsCode, 0, @Context.Overlapped);
    if WaitForSingleObject(Context.Event, Remaining) <> WAIT_OBJECT_0 then begin
      GetAddrInfoExCancel(@Context.NameHandle);
      { Completion releases its own heap storage later; neither this worker nor the UI waits indefinitely. }
      raise EInvalidOpException.Create('The website name lookup reached its time limit.');
    end;
    if Context.ErrorCode <> 0 then raise EInvalidOpException.Create('The website address could not be resolved.');
    Addresses := Context.Addresses; Context.Addresses := nil;
  finally ReleaseDns(Context) end;
  try
    Current := Addresses;
    Preferred := Addresses;
    if Current = nil then raise EInvalidOpException.Create('No website address was returned.');
    while Current <> nil do begin
      if not PublicAddress(Current.Address, Current.Family) then
        raise ELinkBlocked.Create('Private, local and reserved network addresses are not checked.');
      if Current.Family = AF_INET then Preferred := Current;
      Current := Current.Next;
    end;
    AddressLength := Length(AddressText);
    if WSAAddressToStringW(Preferred.Address^, Preferred.AddressLength, nil, AddressText, AddressLength) <> 0 then
      raise EInvalidOpException.Create('The verified website address could not be prepared.');
    NumericAddress := string(AddressText).Trim(['[', ']']);
  finally if Addresses <> nil then FreeAddrInfoExW(Addresses) end;
end;

function HeaderText(Request: HINTERNET; Header: DWORD): string;
var Buffer: array[0..2048] of WideChar; Count: DWORD;
begin
  Result := ''; Count := SizeOf(Buffer);
  if WinHttpQueryHeaders(Request, Header, nil, @Buffer[0], Count, nil) then Result := string(Buffer);
end;

function CheckLink(const Url: string; BatchDeadline: UInt64): string;
var CurrentUrl, Host, Resource, NumericAddress, Location, Method, MessageText, State: string;
  Session, Connection, Request: HINTERNET; Port: Word; Secure: Boolean;
  Disable, Policy, Code, Size: DWORD; ResultObject: TJSONObject;
  Deadline: UInt64; Budget: Integer; Combined: array[0..2048] of WideChar; CombinedLength: DWORD;
begin
  State := 'unverified'; MessageText := 'This link needs a manual browser check.'; Code := 0;
  try
    CurrentUrl := Url;
    Deadline := Min(GetTickCount64 + 10000, BatchDeadline);
    for var Redirect := 0 to 3 do begin
      ValidateAddress(CurrentUrl, Host, Resource, NumericAddress, Port, Secure, Deadline);
      Session := WinHttpOpen('DelphiWebStudio-LinkCheck/1.0', WINHTTP_ACCESS_TYPE_NO_PROXY, nil, nil, 0);
      if Session = nil then RaiseLastOSError;
      try
        Policy := 1;
        if not WinHttpSetOption(Session, WINHTTP_OPTION_CONNECT_RETRIES, @Policy, SizeOf(Policy)) then RaiseLastOSError;
        Connection := WinHttpConnect(Session, PChar(Host), Port, 0);
        if Connection = nil then RaiseLastOSError;
        try
          Method := 'HEAD'; Location := '';
          for var Attempt := 0 to 1 do begin
            Budget := Min(2000, (Int64(Deadline) - Int64(GetTickCount64)) div 5);
            if Budget <= 0 then raise EInvalidOpException.Create('The link check reached its time limit.');
            if not WinHttpSetTimeouts(Session, Budget, Budget, Budget, Budget) then RaiseLastOSError;
            var Flags: DWORD := WINHTTP_FLAG_REFRESH;
            if Secure then Flags := Flags or WINHTTP_FLAG_SECURE;
            Request := WinHttpOpenRequest(Connection, PChar(Method), PChar(Resource), nil, nil, nil, Flags);
            if Request = nil then RaiseLastOSError;
            try
              Disable := WINHTTP_DISABLE_REDIRECTS or WINHTTP_DISABLE_AUTHENTICATION or WINHTTP_DISABLE_COOKIES or WINHTTP_DISABLE_KEEP_ALIVE;
              if not WinHttpSetOption(Request, WINHTTP_OPTION_DISABLE_FEATURE, @Disable, SizeOf(Disable)) then RaiseLastOSError;
              { Pin the checked IP for this request. DNS is not consulted a second time;
                Host/SNI and certificate validation still use the original website host.
                Older Windows that cannot honor this option return unverified, never an unsafe fallback. }
              if not WinHttpSetOption(Request, WINHTTP_OPTION_RESOLUTION_HOSTNAME, PChar(NumericAddress), Length(NumericAddress) * SizeOf(Char)) then
                raise EInvalidOpException.Create('Windows cannot safely pin this website address.');
              Policy := WINHTTP_AUTOLOGON_SECURITY_LEVEL_HIGH;
              if not WinHttpSetOption(Request, WINHTTP_OPTION_AUTOLOGON_POLICY, @Policy, SizeOf(Policy)) then RaiseLastOSError;
              Policy := Budget;
              if not WinHttpSetOption(Request, WINHTTP_OPTION_RECEIVE_RESPONSE_TIMEOUT, @Policy, SizeOf(Policy)) then RaiseLastOSError;
              Policy := 16384;
              if not WinHttpSetOption(Request, WINHTTP_OPTION_MAX_RESPONSE_HEADER_SIZE, @Policy, SizeOf(Policy)) then RaiseLastOSError;
              if Method = 'GET' then WinHttpAddRequestHeaders(Request, 'Range: bytes=0-0', DWORD(-1), WINHTTP_ADDREQ_FLAG_ADD);
              if not WinHttpSendRequest(Request, nil, 0, nil, 0, 0, 0) or not WinHttpReceiveResponse(Request, nil) then RaiseLastOSError;
              Size := SizeOf(Code);
              if not WinHttpQueryHeaders(Request, WINHTTP_QUERY_STATUS_CODE or WINHTTP_QUERY_FLAG_NUMBER, nil, @Code, Size, nil) then RaiseLastOSError;
              Location := HeaderText(Request, WINHTTP_QUERY_LOCATION);
              { Only response headers are inspected. No body, cookies or authentication are read or retained. }
            finally WinHttpCloseHandle(Request) end;
            if (Attempt = 0) and ((Code = 405) or (Code = 501)) then Method := 'GET' else Break;
          end;
        finally WinHttpCloseHandle(Connection) end;
      finally WinHttpCloseHandle(Session) end;
      if (Code >= 300) and (Code <= 399) and (Location <> '') then begin
        if Redirect = 3 then begin MessageText := 'Too many redirects; check this link in a browser.'; Break end;
        if Location.StartsWith('//') then raise ELinkBlocked.Create('A protocol-relative redirect was not followed.');
        CombinedLength := Length(Combined);
        if Failed(UrlCombine(PChar(CurrentUrl), PChar(Location), Combined, CombinedLength, 0)) then
          raise ELinkBlocked.Create('This redirect address could not be checked safely.');
        CurrentUrl := string(Combined);
        if Secure and CurrentUrl.StartsWith('http://', True) then
          raise ELinkBlocked.Create('An HTTPS-to-HTTP redirect needs a manual browser check.');
        Continue;
      end;
      if (Code >= 200) and (Code <= 299) then begin State := 'ok'; MessageText := 'The website responded successfully.' end
      else if (Code = 404) or (Code = 410) then begin State := 'broken'; MessageText := 'The website reported that this page is missing.' end
      else if (Code = 401) or (Code = 403) or (Code = 429) then MessageText := 'The website restricted this automated check; check it in your browser.'
      else MessageText := 'The website returned HTTP ' + IntToStr(Code) + '; check the link manually.';
      Break;
    end;
  except
    on E: ELinkBlocked do begin State := 'blocked'; MessageText := E.Message end;
    on E: Exception do begin State := 'unverified'; MessageText := 'The website could not be checked within the connection limits. Try it in a browser.' end;
  end;
  ResultObject := TJSONObject.Create;
  try
    ResultObject.AddPair('url', Url); ResultObject.AddPair('status', State);
    if Code > 0 then ResultObject.AddPair('httpStatus', TJSONNumber.Create(Code));
    ResultObject.AddPair('message', MessageText); Result := ResultObject.ToJSON;
  finally ResultObject.Free end;
end;

function CheckExternalLinks(const Urls: TArray<string>): string;
var Results: TArray<string>; Counter: Integer; Startup: TWSAData; ArrayValue: TJSONArray; Deadline: UInt64;
begin
  if (Length(Urls) = 0) or (Length(Urls) > 20) then raise EArgumentException.Create('Check between one and twenty website links at a time.');
  if WSAStartup($0202, Startup) <> 0 then raise EInvalidOpException.Create('Windows networking is unavailable.');
  try
    SetLength(Results, Length(Urls)); Counter := -1; Deadline := GetTickCount64 + 60000;
    TParallel.For(0, Min(3, High(Urls)), procedure(Worker: Integer)
      var Index: Integer;
      begin
        repeat
          Index := TInterlocked.Increment(Counter);
          if Index > High(Urls) then Break;
          Results[Index] := CheckLink(Urls[Index], Deadline);
        until False;
      end);
    ArrayValue := TJSONArray.Create;
    try
      for var Item in Results do ArrayValue.AddElement(TJSONObject.ParseJSONValue(Item));
      Result := ArrayValue.ToJSON;
    finally ArrayValue.Free end;
  finally WSACleanup end;
end;

end.
