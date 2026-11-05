#!/usr/bin/env python3
"""
REEMBOLSOS — instala no projeto o endpoint que marca uma venda como reembolsada pelo transaction_id (HP).

  uso (na RAIZ do projeto):   python aplicar-reembolsos.py .
                              python aplicar-reembolsos.py . --dry-run     (só mostra o que faria)
                              python aplicar-reembolsos.py . --desfazer    (apaga os 2 arquivos que ele criou)

Cria 2 arquivos NOVOS (não altera nenhum arquivo seu):
  lib/reembolsos.ts                    a lógica (ler o HP, marcar/desfazer, conferir que o banco agiu)
  app/api/reembolsos/route.ts          o endpoint:  POST /api/reembolsos   (e DELETE para desfazer)
O que faz a venda SAIR dos números é o GATILHO do banco: rode os arquivos sql/01 (sozinho) e sql/02 no Supabase.
TUDO-OU-NADA, pode rodar de novo ("já aplicado"), não sobrescreve arquivo seu que seja diferente, mantém CRLF/LF do projeto.
"""
import sys, os, base64, hashlib
try: sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception: pass
args = [a for a in sys.argv[1:] if not a.startswith('--')]; flags = {a for a in sys.argv[1:] if a.startswith('--')}
if len(args) != 1 or not flags <= {'--dry-run', '--desfazer'}: print(__doc__); sys.exit(2)
ROOT, DRY, UNDO = args[0], '--dry-run' in flags, '--desfazer' in flags
ARQUIVOS = {  # caminho → (sha256 do texto com \n, conteúdo em base64)
  'lib/reembolsos.ts': ('04ad319534127da932b5eb29ee6129dba7a7065bb0fb40366ded6e72ff1855bb',
    'Ly8g4pWQ4pWQIFJFRU1CT0xTT1Mg4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ'
    '4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ'
    '4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ'
    '4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ'
    '4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQCi8vIE1hcmNhIChvdSBkZXNmYXopIG8gcmVlbWJvbHNv'
    'IGRlIHZlbmRhcyBwZWxvIHRyYW5zYWN0aW9uX2lkIChvICJIUCIgZGEgSG90bWFydCkuIFF1ZW0gZmF6IGEgdmVuZGEgU0FJUiBk'
    'b3MgbsO6bWVyb3Mgw6kgbyBHQVRJTEhPIGRvIGJhbmNvCi8vIChzcWwvMDJfcmVlbWJvbHNvX2NhbXBvc19lX2dhdGlsaG8uc3Fs'
    'KTogYW8gY29sb2NhciBpc19yZWZ1bmRlZCA9IHRydWUgYSBsaW5oYSBkZWl4YSBkZSBzZXIgZXZlbnRfdHlwZSAnc2FsZScsIGUg'
    'byBzaXN0ZW1hIGludGVpcm8gc8OzIGNvbnRhICdzYWxlJy4KLy8gRXN0YSBmdW7Dp8OjbyBzw7MgbWFyY2EgbyBmbGFnIGUgQ09O'
    'RkVSRSBxdWUgbyBnYXRpbGhvIGFnaXUgKHNlIGEgbWlncmHDp8OjbyBuw6NvIGZvaSBhcGxpY2FkYSwgZGVzZmF6IG8gcXVlIGZl'
    'eiBlIGF2aXNhIOKAlCBudW5jYSBkZWl4YSBhIHZlbmRhICJtZWlvIHJlZW1ib2xzYWRhIikuCmV4cG9ydCBpbnRlcmZhY2UgUmVl'
    'bWJvbHNvSXRlbSB7IHRyYW5zYWN0aW9uX2lkOiBzdHJpbmc7IG1vdGl2bz86IHN0cmluZyB9CmV4cG9ydCB0eXBlIFJlZW1ib2xz'
    'b1N0YXR1cyA9ICdyZWVtYm9sc2FkbycgfCAnamFfcmVlbWJvbHNhZG8nIHwgJ25hb19lbmNvbnRyYWRvJyB8ICduYW9fZV92ZW5k'
    'YScgfCAnZGVzZmVpdG8nIHwgJ25hb19lc3RhdmFfcmVlbWJvbHNhZG8nIHwgJ2Vycm8nCmV4cG9ydCBpbnRlcmZhY2UgUmVlbWJv'
    'bHNvUmVzdWx0YWRvIHsgdHJhbnNhY3Rpb25faWQ6IHN0cmluZzsgc3RhdHVzOiBSZWVtYm9sc29TdGF0dXM7IGxpbmhhczogbnVt'
    'YmVyOyB2YWxvcjogbnVtYmVyOyBtZW5zYWdlbT86IHN0cmluZyB9CmV4cG9ydCBjb25zdCBNQVhfUkVFTUJPTFNPU19QT1JfQ0hB'
    'TUFEQSA9IDUwMAoKY29uc3QgQ0FNUE9TX0hQID0gWyd0cmFuc2FjdGlvbl9pZCcsICd0cmFuc2FjdGlvbklkJywgJ3RyYW5zYWN0'
    'aW9uJywgJ2hwJywgJ0hQJ10KY29uc3QgSFBfVkFMSURPID0gL15bQS1aYS16MC05X1wtLl17Myw2NH0kLwpmdW5jdGlvbiBwZWdh'
    'SHAobzogYW55KTogc3RyaW5nIHwgbnVsbCB7CiAgaWYgKHR5cGVvZiBvID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgbyA9PT0gJ251'
    'bWJlcicpIHJldHVybiBTdHJpbmcobykKICBpZiAoIW8gfHwgdHlwZW9mIG8gIT09ICdvYmplY3QnKSByZXR1cm4gbnVsbAogIGZv'
    'ciAoY29uc3QgayBvZiBDQU1QT1NfSFApIGlmICh0eXBlb2Ygb1trXSA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIG9ba10gPT09ICdu'
    'dW1iZXInKSByZXR1cm4gU3RyaW5nKG9ba10pCiAgY29uc3QgaG90ID0gbz8uZGF0YT8ucHVyY2hhc2U/LnRyYW5zYWN0aW9uID8/'
    'IG8/LnB1cmNoYXNlPy50cmFuc2FjdGlvbiAgICAgICAgICAgICAgICAgICAgICAvLyBvIGF2aXNvIGRlIHJlZW1ib2xzbyBkYSBw'
    'csOzcHJpYSBIb3RtYXJ0IChQVVJDSEFTRV9SRUZVTkRFRCkKICByZXR1cm4gdHlwZW9mIGhvdCA9PT0gJ3N0cmluZycgPyBob3Qg'
    'OiBudWxsCn0KLyoqIEFjZWl0YTogeyB0cmFuc2FjdGlvbl9pZCB9IMK3IHsgdHJhbnNhY3Rpb25faWQsIG1vdGl2byB9IMK3IHsg'
    'dHJhbnNhY3Rpb25faWRzOiBbLi4uXSB9IMK3IFsge3RyYW5zYWN0aW9uX2lkfSwgIkhQLi4uIiBdIMK3IG8gSlNPTiBkbyBhdmlz'
    'byBkYSBIb3RtYXJ0LiBQYXJhIERFU0ZBWkVSOiB7IGRlc2ZhemVyOiB0cnVlIH0gKG91IG8gbcOpdG9kbyBERUxFVEUpLiAqLwpl'
    'eHBvcnQgZnVuY3Rpb24gcGFyc2VSZWVtYm9sc29Cb2R5KGJvZHk6IGFueSk6IHsgaXRlbXM6IFJlZW1ib2xzb0l0ZW1bXTsgcmVq'
    'ZWN0ZWQ6IHN0cmluZ1tdOyBkZXNmYXplcjogYm9vbGVhbiB9IHsKICBjb25zdCBvYmogPSBib2R5ICYmIHR5cGVvZiBib2R5ID09'
    'PSAnb2JqZWN0JyAmJiAhQXJyYXkuaXNBcnJheShib2R5KQogIGNvbnN0IGRlc2ZhemVyID0gISFvYmogJiYgKGJvZHkuZGVzZmF6'
    'ZXIgPT09IHRydWUgfHwgYm9keS51bmRvID09PSB0cnVlIHx8IGJvZHkuYWN0aW9uID09PSAnZGVzZmF6ZXInIHx8IGJvZHkuYWN0'
    'aW9uID09PSAndW5kbycgfHwgYm9keS5yZWZ1bmRlZCA9PT0gZmFsc2UpCiAgY29uc3QgbW90aXZvR2VyYWwgPSBvYmogJiYgdHlw'
    'ZW9mIChib2R5Lm1vdGl2byA/PyBib2R5LnJlYXNvbikgPT09ICdzdHJpbmcnID8gU3RyaW5nKGJvZHkubW90aXZvID8/IGJvZHku'
    'cmVhc29uKSA6IHVuZGVmaW5lZAogIGNvbnN0IGxpc3RhOiBhbnlbXSA9IEFycmF5LmlzQXJyYXkoYm9keSkgPyBib2R5IDogb2Jq'
    'ICYmIEFycmF5LmlzQXJyYXkoYm9keS50cmFuc2FjdGlvbl9pZHMpID8gYm9keS50cmFuc2FjdGlvbl9pZHMgOiBvYmogJiYgQXJy'
    'YXkuaXNBcnJheShib2R5Lml0ZW1zKSA/IGJvZHkuaXRlbXMgOiBbYm9keV0KICBjb25zdCBpdGVtczogUmVlbWJvbHNvSXRlbVtd'
    'ID0gW10sIHJlamVjdGVkOiBzdHJpbmdbXSA9IFtdLCB2aXN0b3MgPSBuZXcgU2V0PHN0cmluZz4oKQogIGZvciAoY29uc3QgeCBv'
    'ZiBsaXN0YSkgewogICAgY29uc3QgYnJ1dG8gPSBwZWdhSHAoeCk/LnRyaW0oKQogICAgaWYgKCFicnV0bykgeyByZWplY3RlZC5w'
    'dXNoKCdzZW0gdHJhbnNhY3Rpb25faWQnKTsgY29udGludWUgfQogICAgaWYgKCFIUF9WQUxJRE8udGVzdChicnV0bykpIHsgcmVq'
    'ZWN0ZWQucHVzaChgdHJhbnNhY3Rpb25faWQgaW52w6FsaWRvOiAke2JydXRvLnNsaWNlKDAsIDQwKX1gKTsgY29udGludWUgfQog'
    'ICAgaWYgKHZpc3Rvcy5oYXMoYnJ1dG8udG9VcHBlckNhc2UoKSkpIGNvbnRpbnVlCiAgICB2aXN0b3MuYWRkKGJydXRvLnRvVXBw'
    'ZXJDYXNlKCkpCiAgICBjb25zdCBtID0geCAmJiB0eXBlb2YgeCA9PT0gJ29iamVjdCcgJiYgdHlwZW9mICh4Lm1vdGl2byA/PyB4'
    'LnJlYXNvbikgPT09ICdzdHJpbmcnID8gU3RyaW5nKHgubW90aXZvID8/IHgucmVhc29uKSA6IG1vdGl2b0dlcmFsCiAgICBpdGVt'
    'cy5wdXNoKHsgdHJhbnNhY3Rpb25faWQ6IGJydXRvLCBtb3Rpdm86IG0gPyBtLnNsaWNlKDAsIDUwMCkgOiB1bmRlZmluZWQgfSkK'
    'ICB9CiAgcmV0dXJuIHsgaXRlbXMsIHJlamVjdGVkLCBkZXNmYXplciB9Cn0KCmNvbnN0IGVzY2FwYUxpa2UgPSAoczogc3RyaW5n'
    'KSA9PiBzLnJlcGxhY2UoL1tcXCVfXS9nLCBjID0+ICdcXCcgKyBjKQpjb25zdCBDT0xTID0gJ2lkLCBldmVudF90eXBlLCBpc19y'
    'ZWZ1bmRlZCwgdmFsdWUsIHRyYW5zYWN0aW9uX2lkJwp0eXBlIExpbmhhID0geyBpZDogc3RyaW5nOyBldmVudF90eXBlOiBzdHJp'
    'bmc7IGlzX3JlZnVuZGVkOiBib29sZWFuIHwgbnVsbDsgdmFsdWU6IG51bWJlciB8IHN0cmluZyB8IG51bGw7IHRyYW5zYWN0aW9u'
    'X2lkOiBzdHJpbmcgfQpjb25zdCBzb21hID0gKGxzOiBMaW5oYVtdKSA9PiBNYXRoLnJvdW5kKGxzLnJlZHVjZSgocywgbCkgPT4g'
    'cyArIChOdW1iZXIobC52YWx1ZSkgfHwgMCksIDApICogMTAwKSAvIDEwMAoKYXN5bmMgZnVuY3Rpb24gYWNoYXIoYWRtaW46IGFu'
    'eSwgaHA6IHN0cmluZyk6IFByb21pc2U8eyBsaW5oYXM6IExpbmhhW107IGVycm8/OiBzdHJpbmcgfT4gewogIGxldCByID0gYXdh'
    'aXQgYWRtaW4uZnJvbSgndGVsYW9fZXZlbnRzJykuc2VsZWN0KENPTFMpLmVxKCd0cmFuc2FjdGlvbl9pZCcsIGhwKS5saW1pdCg1'
    'MCkKICBpZiAoci5lcnJvcikgcmV0dXJuIHsgbGluaGFzOiBbXSwgZXJybzogci5lcnJvci5tZXNzYWdlIH0KICBpZiAoIXIuZGF0'
    'YT8ubGVuZ3RoKSB7IHIgPSBhd2FpdCBhZG1pbi5mcm9tKCd0ZWxhb19ldmVudHMnKS5zZWxlY3QoQ09MUykuaWxpa2UoJ3RyYW5z'
    'YWN0aW9uX2lkJywgZXNjYXBhTGlrZShocCkpLmxpbWl0KDUwKTsgaWYgKHIuZXJyb3IpIHJldHVybiB7IGxpbmhhczogW10sIGVy'
    'cm86IHIuZXJyb3IubWVzc2FnZSB9IH0gICAvLyBkaWZlcmVuw6dhIGRlIG1hacO6c2N1bGFzL21pbsO6c2N1bGFzCiAgcmV0dXJu'
    'IHsgbGluaGFzOiAoci5kYXRhID8/IFtdKSBhcyBMaW5oYVtdIH0KfQoKZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGFwbGljYXJSZWVt'
    'Ym9sc29zKGFkbWluOiBhbnksIGl0ZW1zOiBSZWVtYm9sc29JdGVtW10sIGRlc2ZhemVyID0gZmFsc2UpOiBQcm9taXNlPFJlZW1i'
    'b2xzb1Jlc3VsdGFkb1tdPiB7CiAgY29uc3Qgb3V0OiBSZWVtYm9sc29SZXN1bHRhZG9bXSA9IFtdCiAgZm9yIChjb25zdCBpdCBv'
    'ZiBpdGVtcykgewogICAgY29uc3QgYmFzZSA9IHsgdHJhbnNhY3Rpb25faWQ6IGl0LnRyYW5zYWN0aW9uX2lkIH0KICAgIGNvbnN0'
    'IHsgbGluaGFzLCBlcnJvIH0gPSBhd2FpdCBhY2hhcihhZG1pbiwgaXQudHJhbnNhY3Rpb25faWQpCiAgICBpZiAoZXJybykgeyBv'
    'dXQucHVzaCh7IC4uLmJhc2UsIHN0YXR1czogJ2Vycm8nLCBsaW5oYXM6IDAsIHZhbG9yOiAwLCBtZW5zYWdlbTogL2lzX3JlZnVu'
    'ZGVkfHJlZnVuZGVkfGNvbHVtbi9pLnRlc3QoZXJybykgPyAnT3MgY2FtcG9zIGRlIHJlZW1ib2xzbyBuw6NvIGV4aXN0ZW0gbm8g'
    'YmFuY286IHJvZGUgcHJpbWVpcm8gb3MgYXJxdWl2b3MgU1FMIDAxIGUgMDIuJyA6IGBFcnJvIGFvIGNvbnN1bHRhcjogJHtlcnJv'
    'fWAgfSk7IGNvbnRpbnVlIH0KICAgIGlmICghbGluaGFzLmxlbmd0aCkgeyBvdXQucHVzaCh7IC4uLmJhc2UsIHN0YXR1czogJ25h'
    'b19lbmNvbnRyYWRvJywgbGluaGFzOiAwLCB2YWxvcjogMCB9KTsgY29udGludWUgfQogICAgaWYgKCFkZXNmYXplcikgewogICAg'
    'ICBjb25zdCBhbHZvID0gbGluaGFzLmZpbHRlcihsID0+IGwuZXZlbnRfdHlwZSA9PT0gJ3NhbGUnICYmICFsLmlzX3JlZnVuZGVk'
    'KSwgamFGZWl0YXMgPSBsaW5oYXMuZmlsdGVyKGwgPT4gbC5pc19yZWZ1bmRlZCkKICAgICAgaWYgKCFhbHZvLmxlbmd0aCkgeyBv'
    'dXQucHVzaCh7IC4uLmJhc2UsIHN0YXR1czogamFGZWl0YXMubGVuZ3RoID8gJ2phX3JlZW1ib2xzYWRvJyA6ICduYW9fZV92ZW5k'
    'YScsIGxpbmhhczogamFGZWl0YXMubGVuZ3RoIHx8IGxpbmhhcy5sZW5ndGgsIHZhbG9yOiBzb21hKGphRmVpdGFzLmxlbmd0aCA/'
    'IGphRmVpdGFzIDogbGluaGFzKSB9KTsgY29udGludWUgfQogICAgICBjb25zdCBpZHMgPSBhbHZvLm1hcChsID0+IGwuaWQpCiAg'
    'ICAgIGNvbnN0IHVwID0gYXdhaXQgYWRtaW4uZnJvbSgndGVsYW9fZXZlbnRzJykudXBkYXRlKHsgaXNfcmVmdW5kZWQ6IHRydWUs'
    'IHJlZnVuZGVkX2F0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksIHJlZnVuZF9yZWFzb246IGl0Lm1vdGl2byA/PyBudWxsIH0p'
    'LmluKCdpZCcsIGlkcykKICAgICAgaWYgKHVwLmVycm9yKSB7IG91dC5wdXNoKHsgLi4uYmFzZSwgc3RhdHVzOiAnZXJybycsIGxp'
    'bmhhczogMCwgdmFsb3I6IDAsIG1lbnNhZ2VtOiAvaXNfcmVmdW5kZWR8cmVmdW5kZWR8Y29sdW1uL2kudGVzdCh1cC5lcnJvci5t'
    'ZXNzYWdlKSA/ICdPcyBjYW1wb3MgZGUgcmVlbWJvbHNvIG7Do28gZXhpc3RlbSBubyBiYW5jbzogcm9kZSBwcmltZWlybyBvcyBh'
    'cnF1aXZvcyBTUUwgMDEgZSAwMi4nIDogYEVycm8gYW8gZ3JhdmFyOiAke3VwLmVycm9yLm1lc3NhZ2V9YCB9KTsgY29udGludWUg'
    'fQogICAgICBjb25zdCBjb25mID0gYXdhaXQgYWRtaW4uZnJvbSgndGVsYW9fZXZlbnRzJykuc2VsZWN0KENPTFMpLmluKCdpZCcs'
    'IGlkcykgICAgICAgICAgICAgICAgICAgICAgLy8gQ09ORkVSRSBxdWUgbyBnYXRpbGhvIHRpcm91IGEgbGluaGEgZGUgJ3NhbGUn'
    'CiAgICAgIGNvbnN0IGFpbmRhID0gKChjb25mLmRhdGEgPz8gW10pIGFzIExpbmhhW10pLmZpbHRlcihsID0+IGwuZXZlbnRfdHlw'
    'ZSA9PT0gJ3NhbGUnKQogICAgICBpZiAoY29uZi5lcnJvciB8fCBhaW5kYS5sZW5ndGgpIHsKICAgICAgICBhd2FpdCBhZG1pbi5m'
    'cm9tKCd0ZWxhb19ldmVudHMnKS51cGRhdGUoeyBpc19yZWZ1bmRlZDogZmFsc2UsIHJlZnVuZGVkX2F0OiBudWxsLCByZWZ1bmRf'
    'cmVhc29uOiBudWxsIH0pLmluKCdpZCcsIGlkcykgICAgICAgLy8gZGVzZmF6OiBudW5jYSBkZWl4YSAibWVpbyByZWVtYm9sc2Fk'
    'YSIKICAgICAgICBvdXQucHVzaCh7IC4uLmJhc2UsIHN0YXR1czogJ2Vycm8nLCBsaW5oYXM6IDAsIHZhbG9yOiAwLCBtZW5zYWdl'
    'bTogJ08gZ2F0aWxobyBkbyBiYW5jbyBuw6NvIGVzdMOhIGF0aXZvIChhIHZlbmRhIGNvbnRpbnVhcmlhIGNvbnRhbmRvKS4gTmFk'
    'YSBmb2kgYWx0ZXJhZG8uIFJvZGUgbyBhcnF1aXZvIFNRTCAwMi4nIH0pOyBjb250aW51ZQogICAgICB9CiAgICAgIG91dC5wdXNo'
    'KHsgLi4uYmFzZSwgc3RhdHVzOiAncmVlbWJvbHNhZG8nLCBsaW5oYXM6IGFsdm8ubGVuZ3RoLCB2YWxvcjogc29tYShhbHZvKSB9'
    'KQogICAgfSBlbHNlIHsKICAgICAgY29uc3QgYWx2byA9IGxpbmhhcy5maWx0ZXIobCA9PiBsLmlzX3JlZnVuZGVkKQogICAgICBp'
    'ZiAoIWFsdm8ubGVuZ3RoKSB7IG91dC5wdXNoKHsgLi4uYmFzZSwgc3RhdHVzOiAnbmFvX2VzdGF2YV9yZWVtYm9sc2FkbycsIGxp'
    'bmhhczogbGluaGFzLmxlbmd0aCwgdmFsb3I6IHNvbWEobGluaGFzKSB9KTsgY29udGludWUgfQogICAgICBjb25zdCBpZHMgPSBh'
    'bHZvLm1hcChsID0+IGwuaWQpCiAgICAgIGNvbnN0IHVwID0gYXdhaXQgYWRtaW4uZnJvbSgndGVsYW9fZXZlbnRzJykudXBkYXRl'
    'KHsgaXNfcmVmdW5kZWQ6IGZhbHNlIH0pLmluKCdpZCcsIGlkcykKICAgICAgaWYgKHVwLmVycm9yKSB7IG91dC5wdXNoKHsgLi4u'
    'YmFzZSwgc3RhdHVzOiAnZXJybycsIGxpbmhhczogMCwgdmFsb3I6IDAsIG1lbnNhZ2VtOiBgRXJybyBhbyBncmF2YXI6ICR7dXAu'
    'ZXJyb3IubWVzc2FnZX1gIH0pOyBjb250aW51ZSB9CiAgICAgIG91dC5wdXNoKHsgLi4uYmFzZSwgc3RhdHVzOiAnZGVzZmVpdG8n'
    'LCBsaW5oYXM6IGFsdm8ubGVuZ3RoLCB2YWxvcjogc29tYShhbHZvKSB9KQogICAgfQogIH0KICByZXR1cm4gb3V0Cn0K'),
  'app/api/reembolsos/route.ts': ('0da7eb86c55c723926f9f674a5209701217efe36d213937fc2b1adee4e99735b',
    'aW1wb3J0IHsgTmV4dFJlcXVlc3QsIE5leHRSZXNwb25zZSB9IGZyb20gJ25leHQvc2VydmVyJwppbXBvcnQgeyBjcmVhdGVBZG1p'
    'bkNsaWVudCB9IGZyb20gJ0AvbGliL3N1cGFiYXNlL2FkbWluJwppbXBvcnQgeyBhcGxpY2FyUmVlbWJvbHNvcywgTUFYX1JFRU1C'
    'T0xTT1NfUE9SX0NIQU1BREEsIHBhcnNlUmVlbWJvbHNvQm9keSB9IGZyb20gJ0AvbGliL3JlZW1ib2xzb3MnCgpleHBvcnQgY29u'
    'c3QgZHluYW1pYyA9ICdmb3JjZS1keW5hbWljJwoKY29uc3QgQ09SUyA9IHsgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6'
    'ICcqJywgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHMnOiAnUE9TVCwgREVMRVRFLCBPUFRJT05TJywgJ0FjY2Vzcy1Db250'
    'cm9sLUFsbG93LUhlYWRlcnMnOiAnQ29udGVudC1UeXBlLCB4LXdlYmhvb2stc2VjcmV0JyB9CmV4cG9ydCBhc3luYyBmdW5jdGlv'
    'biBPUFRJT05TKCkgeyByZXR1cm4gbmV3IE5leHRSZXNwb25zZShudWxsLCB7IHN0YXR1czogMjA0LCBoZWFkZXJzOiBDT1JTIH0p'
    'IH0KCi8vIE1hcmNhIHZlbmRhcyBjb21vIFJFRU1CT0xTQURBUyBwZWxvIHRyYW5zYWN0aW9uX2lkIChvICJIUCIpLiBBIHZlbmRh'
    'IHNhaSBkZSBUT0RPUyBvcyB2YWxvcmVzIGUgY29udGFnZW5zIChvIGdhdGlsaG8gZG8gYmFuY28gdGlyYSBhIGxpbmhhIGRlICdz'
    'YWxlJykuCi8vICAgUE9TVCAgICB7ICJ0cmFuc2FjdGlvbl9pZCI6ICJIUDAwNTI5MDM4MjAiIH0gICAgICAgICAgICAgICAgICAg'
    'ICAgKG9wY2lvbmFsOiAibW90aXZvIjogInRleHRvIikKLy8gICBQT1NUICAgIHsgInRyYW5zYWN0aW9uX2lkcyI6IFsiSFAuLi4i'
    'LCAiSFAuLi4iXSB9ICAgb3UgICBbIHsidHJhbnNhY3Rpb25faWQiOiAiSFAuLi4ifSwgLi4uIF0gICAgICAgIOKAlCBhdMOpIDUw'
    'MCBwb3IgY2hhbWFkYQovLyAgIERFTEVURSAgeyAidHJhbnNhY3Rpb25faWQiOiAiSFAuLi4iIH0gICAob3UgUE9TVCBjb20gImRl'
    'c2ZhemVyIjogdHJ1ZSkgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg4oCUIERFU0ZBWiBvIHJlZW1ib2xzbyAoYSB2ZW5k'
    'YSB2b2x0YSBhIGNvbnRhcikKLy8gQXV0ZW50aWNhw6fDo286IG8gTUVTTU8gc2VncmVkbyBkb3Mgb3V0cm9zIHdlYmhvb2tzIChj'
    'YWJlw6dhbGhvIHgtd2ViaG9vay1zZWNyZXQgPSB2YXJpw6F2ZWwgV0VCSE9PS19TRUNSRVQpLiBBcXVpIG8gc2VncmVkbyDDqSBP'
    'QlJJR0FUw5NSSU8gKG1leGUgZW0gZGluaGVpcm8pOiBzZW0gZWxlIGNvbmZpZ3VyYWRvIGEgcm90YSByZWN1c2EgdHVkby4KLy8g'
    'w4kgaWRlbXBvdGVudGU6IG1hbmRhciBvIG1lc21vIEhQIGR1YXMgdmV6ZXMgbsOjbyBmYXogbWFsIChhIDLCqiByZXNwb3N0YSBk'
    'aXogImphX3JlZW1ib2xzYWRvIikuCmFzeW5jIGZ1bmN0aW9uIHRyYXRhcihyZXE6IE5leHRSZXF1ZXN0LCBkZXNmYXplclBvck1l'
    'dG9kbzogYm9vbGVhbikgewogIHRyeSB7CiAgICBjb25zdCBzZWNyZXQgPSBwcm9jZXNzLmVudi5XRUJIT09LX1NFQ1JFVAogICAg'
    'aWYgKCFzZWNyZXQpIHJldHVybiBOZXh0UmVzcG9uc2UuanNvbih7IGVycm9yOiAnV0VCSE9PS19TRUNSRVQgbsOjbyBlc3TDoSBj'
    'b25maWd1cmFkbyBubyBzZXJ2aWRvcjogZXN0YSByb3RhIGZpY2EgZmVjaGFkYSBhdMOpIGNvbmZpZ3VyYXInIH0sIHsgc3RhdHVz'
    'OiA1MDAsIGhlYWRlcnM6IENPUlMgfSkKICAgIGlmIChyZXEuaGVhZGVycy5nZXQoJ3gtd2ViaG9vay1zZWNyZXQnKSAhPT0gc2Vj'
    'cmV0KSByZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24oeyBlcnJvcjogJ1VuYXV0aG9yaXplZCcgfSwgeyBzdGF0dXM6IDQwMSwgaGVh'
    'ZGVyczogQ09SUyB9KQoKICAgIGxldCBib2R5OiBhbnkKICAgIHRyeSB7IGJvZHkgPSBhd2FpdCByZXEuanNvbigpIH0gY2F0Y2gg'
    'eyByZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24oeyBlcnJvcjogJ0pTT04gaW52w6FsaWRvJyB9LCB7IHN0YXR1czogNDAwLCBoZWFk'
    'ZXJzOiBDT1JTIH0pIH0KICAgIGNvbnN0IHsgaXRlbXMsIHJlamVjdGVkLCBkZXNmYXplciB9ID0gcGFyc2VSZWVtYm9sc29Cb2R5'
    'KGJvZHkpCiAgICBpZiAoaXRlbXMubGVuZ3RoID09PSAwKSByZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24oeyBlcnJvcjogJ25lbmh1'
    'bSB0cmFuc2FjdGlvbl9pZCB2w6FsaWRvJywgcmVqZWN0ZWQ6IHJlamVjdGVkLnNsaWNlKDAsIDUpIH0sIHsgc3RhdHVzOiA0MDAs'
    'IGhlYWRlcnM6IENPUlMgfSkKICAgIGlmIChpdGVtcy5sZW5ndGggPiBNQVhfUkVFTUJPTFNPU19QT1JfQ0hBTUFEQSkgcmV0dXJu'
    'IE5leHRSZXNwb25zZS5qc29uKHsgZXJyb3I6IGBubyBtw6F4aW1vICR7TUFYX1JFRU1CT0xTT1NfUE9SX0NIQU1BREF9IHRyYW5z'
    'YWN0aW9uX2lkIHBvciBjaGFtYWRhYCB9LCB7IHN0YXR1czogNDEzLCBoZWFkZXJzOiBDT1JTIH0pCgogICAgY29uc3QgcmVzdWx0'
    'YWRvcyA9IGF3YWl0IGFwbGljYXJSZWVtYm9sc29zKGNyZWF0ZUFkbWluQ2xpZW50KCksIGl0ZW1zLCBkZXNmYXplclBvck1ldG9k'
    'byB8fCBkZXNmYXplcikKICAgIGNvbnN0IHJlc3VtbzogUmVjb3JkPHN0cmluZywgbnVtYmVyPiA9IHt9CiAgICBmb3IgKGNvbnN0'
    'IHIgb2YgcmVzdWx0YWRvcykgcmVzdW1vW3Iuc3RhdHVzXSA9IChyZXN1bW9bci5zdGF0dXNdID8/IDApICsgMQogICAgY29uc3Qg'
    'dGVtRXJybyA9IHJlc3VsdGFkb3Muc29tZShyID0+IHIuc3RhdHVzID09PSAnZXJybycpCiAgICByZXR1cm4gTmV4dFJlc3BvbnNl'
    'Lmpzb24oeyBvazogIXRlbUVycm8sIHJlY2ViaWRvczogaXRlbXMubGVuZ3RoLCByZWplaXRhZG9zOiByZWplY3RlZC5sZW5ndGgs'
    'IHJlc3VtbywgcmVzdWx0YWRvcyB9LCB7IHN0YXR1czogdGVtRXJybyA/IDUwMCA6IDIwMCwgaGVhZGVyczogQ09SUyB9KQogIH0g'
    'Y2F0Y2ggKGU6IGFueSkgewogICAgY29uc29sZS5lcnJvcignW3JlZW1ib2xzb3NdJywgZT8ubWVzc2FnZSA/PyBlKQogICAgcmV0'
    'dXJuIE5leHRSZXNwb25zZS5qc29uKHsgZXJyb3I6ICdFcnJvIGFvIHByb2Nlc3NhciBvIHJlZW1ib2xzbycgfSwgeyBzdGF0dXM6'
    'IDUwMCwgaGVhZGVyczogQ09SUyB9KQogIH0KfQpleHBvcnQgYXN5bmMgZnVuY3Rpb24gUE9TVChyZXE6IE5leHRSZXF1ZXN0KSB7'
    'IHJldHVybiB0cmF0YXIocmVxLCBmYWxzZSkgfQpleHBvcnQgYXN5bmMgZnVuY3Rpb24gREVMRVRFKHJlcTogTmV4dFJlcXVlc3Qp'
    'IHsgcmV0dXJuIHRyYXRhcihyZXEsIHRydWUpIH0K'),
}
def txt(b64): return base64.b64decode(b64).decode('utf-8')
def p(rel): return os.path.join(ROOT, *rel.split('/'))
def falha(m): print('NADA foi alterado.\n  - ' + m); sys.exit(1)
def leia(rel):
    raw = open(p(rel), 'rb').read(); bom = raw.startswith(b'\xef\xbb\xbf'); t = (raw[3:] if bom else raw).decode('utf-8'); return t.replace('\r\n', '\n')
if not os.path.isdir(p('app')) or not os.path.isdir(p('lib')): print(__doc__); sys.exit(2)
if UNDO:
    feito = []
    for rel, (h, b64) in ARQUIVOS.items():
        if os.path.exists(p(rel)):
            if leia(rel) == txt(b64):
                if DRY: print(f'(simulação) apagaria {rel}')
                else: os.remove(p(rel)); feito.append(rel)
            else: print(f'  ! {rel} foi alterado por você: NÃO apaguei')
    for d in ('app/api/reembolsos',):
        try:
            if not DRY: os.rmdir(p(d))
        except OSError: pass
    print('Desfeito: ' + ', '.join(feito) if feito else 'Nada a desfazer.'); sys.exit(0)
if not any(os.path.exists(p('lib/supabase/admin' + e)) for e in ('.ts', '.tsx', '.js')): falha('não achei lib/supabase/admin.ts (a rota usa createAdminClient, como os outros endpoints)')
ref = p('lib/supabase/admin.ts')
crlf = os.path.exists(ref) and b'\r\n' in open(ref, 'rb').read()
estado = {}
for rel, (h, b64) in ARQUIVOS.items():
    t = txt(b64)
    if hashlib.sha256(t.encode('utf-8')).hexdigest() != h: falha(f'este script está corrompido ({rel}): baixe de novo.')
    estado[rel] = 'falta' if not os.path.exists(p(rel)) else ('igual' if leia(rel) == t else 'diferente')
dif = [r for r, e in estado.items() if e == 'diferente']
if dif: falha('já existe, com conteúdo diferente, e não vou sobrescrever: ' + ', '.join(dif))
novos = [r for r, e in estado.items() if e == 'falta']
if not novos: print('Já aplicado. Nada foi alterado.'); sys.exit(0)
if DRY: print('(simulação) nada foi gravado. Criaria:'); [print('  + ' + r) for r in novos]; sys.exit(0)
for rel in novos:
    os.makedirs(os.path.dirname(p(rel)), exist_ok=True); t = txt(ARQUIVOS[rel][1]); open(p(rel), 'wb').write((t.replace('\n', '\r\n') if crlf else t).encode('utf-8'))
print('OK: endpoint de reembolso instalado.\n' + '\n'.join('  ✓ ' + r for r in novos))
print("""
PRÓXIMOS PASSOS (nesta ordem — o gatilho do banco é o que tira a venda dos números):
  1) Supabase → SQL Editor: rode sql/01_reembolso_tipo.sql SOZINHO; depois sql/02_reembolso_campos_e_gatilho.sql.
  2) Confirme que a variável WEBHOOK_SECRET existe na Vercel (o endpoint usa a MESMA dos outros webhooks e fica FECHADO sem ela).
  3) git add -A · git commit · git push · espere o deploy.
  4) Teste (troque SEU-SITE e o segredo):
       curl -X POST https://SEU-SITE/api/reembolsos -H "x-webhook-secret: SEU_SEGREDO" -H "Content-Type: application/json" -d '{"transaction_id":"HP0000000000"}'
     Para DESFAZER:   curl -X DELETE ...  (mesmo corpo)     ·     Vários de uma vez:  {"transaction_ids":["HP...","HP..."]}  (até 500)""")
