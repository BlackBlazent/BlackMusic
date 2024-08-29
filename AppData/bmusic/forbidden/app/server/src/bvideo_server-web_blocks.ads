
with AWS.Status;
with AWS.Templates;
with AWS.Services.Web_Block.Context;

package Bvideo_Server.Web_Blocks is

   use AWS;
   use AWS.Services;

   procedure Widget_Counter
     (Request      : in              Status.Data;
      Context      : not null access Web_Block.Context.Object;
      Translations : in out          Templates.Translate_Set);

end Bvideo_Server.Web_Blocks;
