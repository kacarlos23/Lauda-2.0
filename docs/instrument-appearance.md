# Aparência dos instrumentos e cargos

As etiquetas usam fundo neutro, ícone vetorial em círculo colorido e o nome cadastrado. O componente compartilhado atende perfil, lista de membros e seleção de membros.

No cadastro de instrumentos/cargos, a ação **Personalizar ícone e cor** oferece 26 ícones (incluindo opção genérica), busca por nome, 24 cores prontas, hexadecimal e seletor de cor no navegador. O formulário mostra a prévia antes de salvar. Também é possível restaurar o ícone automático pelo nome e a cor padrão. A criação rápida no perfil usa o mesmo editor. As permissões de gestão existentes continuam em vigor.

`Instrument.iconKey` é opcional e persistido no mesmo registro. A migration `20261020170000_instrument_icons` adiciona apenas essa coluna; não recria instrumentos nem altera vínculos. Registros antigos usam o ícone inferido pelo nome. A cor já cadastrada é preservada. Atualizações visuais afetam todos os membros vinculados ao instrumento; nomes, IDs e relatórios continuam usando os dados existentes.

A API valida as chaves permitidas e o formato hexadecimal, e mantém filtros por tenant nas alterações. O campo é retornado no catálogo e nos instrumentos dos membros, da igreja e da autenticação.

Aplicado no ambiente isolado em `127.0.0.1:8093`, com API `127.0.0.1:3010` e banco `127.0.0.1:5435/lauda2_worship_development`. A publicação em produção exige aplicar a migration antes de iniciar o backend atualizado.
