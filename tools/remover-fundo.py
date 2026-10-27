#!/usr/bin/env python3
"""
Tira o FUNDO (branco ou claro) de uma imagem e salva um PNG transparente, no tamanho certo pro Sales Ops AI.

  python3 tools/remover-fundo.py minha-imagem.jpg public/sales-ops-ai.png
  opções:  --tolerancia 40   (0–120; aumente se sobrar borda clara, diminua se comer o desenho)
           --tamanho 256     (lado do PNG quadrado final)
           --margem 4        (% de respiro em volta do desenho)

Como funciona: o fundo é achado a partir das BORDAS da imagem (pixels claros ligados à borda); o que é claro mas está DENTRO do desenho
(olhos brancos, reflexos, óculos…) é preservado. Depois suaviza a borda e tira o "halo" branco. Precisa do Pillow:  pip install pillow
"""
import sys, argparse
from PIL import Image, ImageDraw, ImageFilter, ImageChops

def remover_fundo(src, dst, tol=40, tamanho=256, margem=4.0):
    im = Image.open(src).convert('RGBA'); w, h = im.size
    # cor do fundo = média dos 4 cantos (normalmente branco)
    cantos = [im.getpixel(p)[:3] for p in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1))]
    bg = tuple(sum(c[i] for c in cantos) // 4 for i in range(3))
    if min(bg) < 150: print(f'AVISO: o fundo parece escuro/colorido {bg}; o script foi feito pra fundo claro. Veja o resultado.')
    # 1) inunda a partir das bordas: só o fundo ligado à borda fica transparente
    marca = (1, 2, 3, 254)                                   # cor "sentinela" que não existe na imagem
    work = im.copy()
    seeds = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)] + [(x, 0) for x in range(0, w, max(w // 24, 1))] + [(x, h - 1) for x in range(0, w, max(w // 24, 1))] + [(0, y) for y in range(0, h, max(h // 24, 1))] + [(w - 1, y) for y in range(0, h, max(h // 24, 1))]
    for sd in seeds:
        px = work.getpixel(sd)
        if px == marca: continue
        if sum(abs(px[i] - bg[i]) for i in range(3)) <= tol * 3: ImageDraw.floodfill(work, sd, marca, thresh=tol * 3)
    arr = work.split()
    fundo = Image.eval(ImageChops.difference(work.convert('RGB'), Image.new('RGB', (w, h), marca[:3])).convert('L'), lambda v: 255 if v == 0 else 0)   # 255 = era fundo
    alpha = ImageChops.invert(fundo)
    # 2) bordas: encolhe 1px (corta o halo claro) e suaviza
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.9))
    # 3) tira a contaminação do fundo nas bordas semi-transparentes
    rgb = im.convert('RGB'); out = Image.new('RGBA', (w, h)); rp, ap, op = rgb.load(), alpha.load(), out.load()
    for y in range(h):
        for x in range(w):
            a = ap[x, y]
            if a == 0: op[x, y] = (0, 0, 0, 0); continue
            r, g, b = rp[x, y]
            if a < 255:
                f = a / 255.0
                r, g, b = (max(0, min(255, int((c - bg[i] * (1 - f)) / f))) for i, c in enumerate((r, g, b)))
            op[x, y] = (r, g, b, a)
    # 4) recorta no desenho, deixa quadrado e redimensiona
    bbox = alpha.point(lambda v: 255 if v > 12 else 0).getbbox()
    if not bbox: raise SystemExit('Não achei nada de desenho (a imagem ficou toda transparente). Diminua --tolerancia.')
    out = out.crop(bbox); cw, ch = out.size; lado = int(max(cw, ch) * (1 + margem / 100 * 2))
    quad = Image.new('RGBA', (lado, lado), (0, 0, 0, 0)); quad.paste(out, ((lado - cw) // 2, (lado - ch) // 2), out)
    quad = quad.resize((tamanho, tamanho), Image.LANCZOS); quad.save(dst, optimize=True)
    transp = sum(alpha.histogram()[:10]) / (w * h) * 100
    print(f'OK: {dst} ({tamanho}x{tamanho}). Fundo removido: {transp:.0f}% da imagem original.')
    if transp < 3: print('AVISO: quase nada foi removido (o fundo não é uniforme?). Aumente --tolerancia.')
    if transp > 97: print('AVISO: quase tudo foi removido. Diminua --tolerancia.')

if __name__ == '__main__':
    ap = argparse.ArgumentParser(description='Remove o fundo claro de uma imagem e gera o PNG do ícone.')
    ap.add_argument('entrada'); ap.add_argument('saida'); ap.add_argument('--tolerancia', type=int, default=40); ap.add_argument('--tamanho', type=int, default=256); ap.add_argument('--margem', type=float, default=4.0)
    a = ap.parse_args(); remover_fundo(a.entrada, a.saida, a.tolerancia, a.tamanho, a.margem)
