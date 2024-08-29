@Kendrah > Present; <- Determine the file if .misk/>


get_lib communicate
get_lib
mention_Ada
mention_Python
mention_HTML as embedded
mention_Ruby

onstate_define.@special(); {
    arg_emb("men['HTML']");
    action_write >> [
    <:{
        <!DOCTYPE html>
        <html lang="en-US">
        <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>Authorized Content</title>
        <link rel="icon" href=""/>
        <style></style>
        <scritp></scritp>
        </head>
        <body>
        <notify>
        <div>Authorized Property</div>
        <h4>Accessing this content without a permission is <em>illigal</em>.
        Authorized personnel only.
        </h4>
        </notify>
        </body>
        </html>
    };>
    ]
    run_script.Popup(); {
        function Access();
    }
};