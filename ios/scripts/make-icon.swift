// Renders the 1024×1024 App Store icon: the Strive "S" with the brand's mint square.
// App Store Connect rejects icons with an alpha channel, so this draws into an RGB (alpha-skipped) context.
// Usage: swiftc -O scripts/make-icon.swift -o /tmp/make-icon && /tmp/make-icon <output.png>
import AppKit
import ImageIO
import UniformTypeIdentifiers

let size = 1024
let out = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "AppIcon-1024.png"
let space = CGColorSpace(name: CGColorSpace.sRGB)!

guard let ctx = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0,
                          space: space, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else {
    fatalError("could not create context")
}

func rgb(_ hex: UInt32) -> CGColor {
    CGColor(srgbRed: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
}

// Background: near-black with a soft green glow from the upper left.
ctx.setFillColor(rgb(0x0B0C0B))
ctx.fill(CGRect(x: 0, y: 0, width: size, height: size))
let glow = CGGradient(colorsSpace: space, colors: [rgb(0x1D2D22), rgb(0x0B0C0B)] as CFArray, locations: [0, 1])!
ctx.drawRadialGradient(glow, startCenter: CGPoint(x: 290, y: 780), startRadius: 0,
                       endCenter: CGPoint(x: 290, y: 780), endRadius: 950, options: [.drawsAfterEndLocation])

// The "S" — drawn through AppKit so we get SF Pro Black.
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(cgContext: ctx, flipped: false)
let font = NSFont.systemFont(ofSize: 700, weight: .black)
let letter = NSAttributedString(string: "S", attributes: [
    .font: font,
    .foregroundColor: NSColor(srgbRed: 0.953, green: 0.961, blue: 0.953, alpha: 1),
])
let line = CTLineCreateWithAttributedString(letter)
let glyphBounds = CTLineGetImageBounds(line, ctx)
let originX = (CGFloat(size) - glyphBounds.width) / 2 - glyphBounds.minX - 86
let originY = (CGFloat(size) - glyphBounds.height) / 2 - glyphBounds.minY
ctx.textPosition = CGPoint(x: originX, y: originY)
CTLineDraw(line, ctx)
NSGraphicsContext.restoreGraphicsState()

// Mint square on the baseline, right of the S — echoing the "STRIVE■" wordmark.
let square: CGFloat = 146
ctx.setFillColor(rgb(0x7CE2A5))
ctx.fill(CGRect(x: originX + glyphBounds.maxX + 26, y: originY + glyphBounds.minY, width: square, height: square))

guard let image = ctx.makeImage(),
      let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: out) as CFURL, UTType.png.identifier as CFString, 1, nil) else {
    fatalError("could not create image destination")
}
CGImageDestinationAddImage(dest, image, nil)
guard CGImageDestinationFinalize(dest) else { fatalError("png write failed") }
print("wrote \(out)")
