// Runs the Swift observer at launch without touching the generated app delegate.
// (When the Swift module header name differs, scripts/ios-post-init.mjs rewrites the import below.)
#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

@interface BMAudioObserver : NSObject
+ (void)install;
@end

__attribute__((constructor)) static void bm_install_audio_observer(void) {
    dispatch_async(dispatch_get_main_queue(), ^{
        Class c = NSClassFromString(@"BMAudioObserver");
        if (c && [c respondsToSelector:@selector(install)]) [c performSelector:@selector(install)];
    });
}
