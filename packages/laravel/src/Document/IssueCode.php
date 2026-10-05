<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Document;

enum IssueCode: string
{
    case Type = 'type';
    case Range = 'range';
    case Pattern = 'pattern';
    case Enum = 'enum';
    case Size = 'size';
    case Required = 'required';
    /** Another record already uses the value (a page slug). Parsing never reports it; the editor routes do. */
    case Unique = 'unique';
}
