with Interfaces.Win32; use Interfaces.Win32;

procedure Dsk_Main is
   function MCI_Send_String (
      Command: LPCWSTR;
      Return_String: LPWSTR;
      Return_Length: UINT;
      CallBack: DWORD_PTR
   ) return UINT;
   pragma Import (StdCall, MCI_Send_String, "mciSendStringW");

   -- Open the DVD tray
   procedure Open_DVD_Trayer is
      Command : constant String := "set cdaudio door open";
      Return_String : array(0..255) of Character;
      Return_Length : constant UINT := 255;
   begin
      MCI_Send_String (To_Wide_Wide_String (Command), To_Wide_Wide_String (Return_String'Access), Return_Length, 0);
   end Open_DVD_Trayer;

begin
   Open_DVD_Trayer;
end Dsk_Main;
