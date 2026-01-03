{ pkgs }: {
  deps = [
    pkgs.nodejs-18_x
    pkgs.chromium
    pkgs.glib
    pkgs.nss
    pkgs.nspr
    pkgs.atk
    pkgs.at-spi2-atk
    pkgs.cups
    pkgs.libdrm
    pkgs.dbus
    pkgs.mesa
    pkgs.gbm
    pkgs.expat
    pkgs.pango
    pkgs.cairo
    pkgs.alsa-lib
  ];
}
