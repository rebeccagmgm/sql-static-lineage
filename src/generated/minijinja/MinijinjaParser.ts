
import * as antlr from "antlr4ng";
import { Token } from "antlr4ng";

// for running tests with parameters, TODO: discuss strategy for typed parameters in CI
// eslint-disable-next-line no-unused-vars
type int = number;


export class MinijinjaParser extends antlr.Parser {
    public static readonly RAW_TAG = 1;
    public static readonly EXPR_OPEN = 2;
    public static readonly STMT_OPEN = 3;
    public static readonly COMMENT_OPEN = 4;
    public static readonly RAW_TEXT = 5;
    public static readonly STRAY = 6;
    public static readonly EXPR_CLOSE = 7;
    public static readonly STMT_CLOSE = 8;
    public static readonly JWS = 9;
    public static readonly STRING = 10;
    public static readonly FLOAT = 11;
    public static readonly INT = 12;
    public static readonly TRUE = 13;
    public static readonly FALSE = 14;
    public static readonly NONE = 15;
    public static readonly AND = 16;
    public static readonly OR = 17;
    public static readonly NOT = 18;
    public static readonly IN = 19;
    public static readonly IS = 20;
    public static readonly IF = 21;
    public static readonly ELSE = 22;
    public static readonly ELIF = 23;
    public static readonly ENDIF = 24;
    public static readonly FOR = 25;
    public static readonly ENDFOR = 26;
    public static readonly SET = 27;
    public static readonly ENDSET = 28;
    public static readonly MACRO = 29;
    public static readonly ENDMACRO = 30;
    public static readonly CALL = 31;
    public static readonly ENDCALL = 32;
    public static readonly FILTER = 33;
    public static readonly ENDFILTER = 34;
    public static readonly BLOCK = 35;
    public static readonly ENDBLOCK = 36;
    public static readonly EXTENDS = 37;
    public static readonly INCLUDE = 38;
    public static readonly IMPORT = 39;
    public static readonly FROM = 40;
    public static readonly WITH = 41;
    public static readonly ENDWITH = 42;
    public static readonly AUTOESCAPE = 43;
    public static readonly ENDAUTOESCAPE = 44;
    public static readonly RAW = 45;
    public static readonly ENDRAW = 46;
    public static readonly DO = 47;
    public static readonly BREAK = 48;
    public static readonly CONTINUE = 49;
    public static readonly AS = 50;
    public static readonly ID = 51;
    public static readonly POW = 52;
    public static readonly STAR = 53;
    public static readonly DSLASH = 54;
    public static readonly SLASH = 55;
    public static readonly PLUS = 56;
    public static readonly MINUS = 57;
    public static readonly PERCENT = 58;
    public static readonly EQ = 59;
    public static readonly NE = 60;
    public static readonly LE = 61;
    public static readonly GE = 62;
    public static readonly LT = 63;
    public static readonly GT = 64;
    public static readonly ASSIGN = 65;
    public static readonly LPAREN = 66;
    public static readonly RPAREN = 67;
    public static readonly LBRACK = 68;
    public static readonly RBRACK = 69;
    public static readonly LBRACE = 70;
    public static readonly RBRACE = 71;
    public static readonly COMMA = 72;
    public static readonly COLON = 73;
    public static readonly DOT = 74;
    public static readonly PIPE = 75;
    public static readonly TILDE = 76;
    public static readonly MINIJINJA_ANY = 77;
    public static readonly COMMENT_CLOSE = 78;
    public static readonly COMMENT_TEXT = 79;
    public static readonly COMMENT_ANY = 80;
    public static readonly ENDRAW_TAG = 81;
    public static readonly RAW_BODY = 82;
    public static readonly RAW_BODY_STRAY = 83;
    public static readonly RULE_tag = 0;
    public static readonly RULE_expr_tag = 1;
    public static readonly RULE_stmt_tag = 2;
    public static readonly RULE_comment_tag = 3;
    public static readonly RULE_raw_tag = 4;
    public static readonly RULE_endraw_tag = 5;
    public static readonly RULE_stmt = 6;
    public static readonly RULE_keyword = 7;
    public static readonly RULE_expr = 8;
    public static readonly RULE_cond = 9;
    public static readonly RULE_or_expr = 10;
    public static readonly RULE_and_expr = 11;
    public static readonly RULE_not_expr = 12;
    public static readonly RULE_comparison = 13;
    public static readonly RULE_comp_op = 14;
    public static readonly RULE_concat = 15;
    public static readonly RULE_additive = 16;
    public static readonly RULE_term = 17;
    public static readonly RULE_factor = 18;
    public static readonly RULE_power = 19;
    public static readonly RULE_filtered = 20;
    public static readonly RULE_filter = 21;
    public static readonly RULE_primary = 22;
    public static readonly RULE_arg_list = 23;
    public static readonly RULE_arg = 24;
    public static readonly RULE_subscript = 25;
    public static readonly RULE_slice_bound = 26;
    public static readonly RULE_dict_entry = 27;
    public static readonly RULE_literal = 28;
    public static readonly RULE_id = 29;

    public static readonly literalNames = [
        null, null, null, null, null, null, null, null, null, null, null, 
        null, null, null, null, null, "'and'", "'or'", "'not'", "'in'", 
        "'is'", "'if'", "'else'", "'elif'", "'endif'", "'for'", "'endfor'", 
        "'set'", "'endset'", "'macro'", "'endmacro'", "'call'", "'endcall'", 
        "'filter'", "'endfilter'", "'block'", "'endblock'", "'extends'", 
        "'include'", "'import'", "'from'", "'with'", "'endwith'", "'autoescape'", 
        "'endautoescape'", "'raw'", "'endraw'", "'do'", "'break'", "'continue'", 
        "'as'", null, "'**'", "'*'", "'//'", "'/'", "'+'", "'-'", "'%'", 
        "'=='", "'!='", "'<='", "'>='", "'<'", "'>'", "'='", "'('", "')'", 
        "'['", "']'", "'{'", "'}'", "','", "':'", "'.'", "'|'", "'~'"
    ];

    public static readonly symbolicNames = [
        null, "RAW_TAG", "EXPR_OPEN", "STMT_OPEN", "COMMENT_OPEN", "RAW_TEXT", 
        "STRAY", "EXPR_CLOSE", "STMT_CLOSE", "JWS", "STRING", "FLOAT", "INT", 
        "TRUE", "FALSE", "NONE", "AND", "OR", "NOT", "IN", "IS", "IF", "ELSE", 
        "ELIF", "ENDIF", "FOR", "ENDFOR", "SET", "ENDSET", "MACRO", "ENDMACRO", 
        "CALL", "ENDCALL", "FILTER", "ENDFILTER", "BLOCK", "ENDBLOCK", "EXTENDS", 
        "INCLUDE", "IMPORT", "FROM", "WITH", "ENDWITH", "AUTOESCAPE", "ENDAUTOESCAPE", 
        "RAW", "ENDRAW", "DO", "BREAK", "CONTINUE", "AS", "ID", "POW", "STAR", 
        "DSLASH", "SLASH", "PLUS", "MINUS", "PERCENT", "EQ", "NE", "LE", 
        "GE", "LT", "GT", "ASSIGN", "LPAREN", "RPAREN", "LBRACK", "RBRACK", 
        "LBRACE", "RBRACE", "COMMA", "COLON", "DOT", "PIPE", "TILDE", "MINIJINJA_ANY", 
        "COMMENT_CLOSE", "COMMENT_TEXT", "COMMENT_ANY", "ENDRAW_TAG", "RAW_BODY", 
        "RAW_BODY_STRAY"
    ];
    public static readonly ruleNames = [
        "tag", "expr_tag", "stmt_tag", "comment_tag", "raw_tag", "endraw_tag", 
        "stmt", "keyword", "expr", "cond", "or_expr", "and_expr", "not_expr", 
        "comparison", "comp_op", "concat", "additive", "term", "factor", 
        "power", "filtered", "filter", "primary", "arg_list", "arg", "subscript", 
        "slice_bound", "dict_entry", "literal", "id",
    ];

    public get grammarFileName(): string { return "MinijinjaParser.g4"; }
    public get literalNames(): (string | null)[] { return MinijinjaParser.literalNames; }
    public get symbolicNames(): (string | null)[] { return MinijinjaParser.symbolicNames; }
    public get ruleNames(): string[] { return MinijinjaParser.ruleNames; }
    public get serializedATN(): number[] { return MinijinjaParser._serializedATN; }

    protected createFailedPredicateException(predicate?: string, message?: string): antlr.FailedPredicateException {
        return new antlr.FailedPredicateException(this, predicate, message);
    }

    public constructor(input: antlr.TokenStream) {
        super(input);
        this.interpreter = new antlr.ParserATNSimulator(this, MinijinjaParser._ATN, MinijinjaParser.decisionsToDFA, new antlr.PredictionContextCache());
    }
    public tag(): TagContext {
        let localContext = new TagContext(this.context, this.state);
        this.enterRule(localContext, 0, MinijinjaParser.RULE_tag);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 69;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 126) !== 0) || _la === 81) {
                {
                this.state = 67;
                this.errorHandler.sync(this);
                switch (this.tokenStream.LA(1)) {
                case MinijinjaParser.EXPR_OPEN:
                    {
                    this.state = 60;
                    this.expr_tag();
                    }
                    break;
                case MinijinjaParser.STMT_OPEN:
                    {
                    this.state = 61;
                    this.stmt_tag();
                    }
                    break;
                case MinijinjaParser.COMMENT_OPEN:
                    {
                    this.state = 62;
                    this.comment_tag();
                    }
                    break;
                case MinijinjaParser.RAW_TAG:
                    {
                    this.state = 63;
                    this.raw_tag();
                    }
                    break;
                case MinijinjaParser.ENDRAW_TAG:
                    {
                    this.state = 64;
                    this.endraw_tag();
                    }
                    break;
                case MinijinjaParser.RAW_TEXT:
                    {
                    this.state = 65;
                    this.match(MinijinjaParser.RAW_TEXT);
                    }
                    break;
                case MinijinjaParser.STRAY:
                    {
                    this.state = 66;
                    this.match(MinijinjaParser.STRAY);
                    }
                    break;
                default:
                    throw new antlr.NoViableAltException(this);
                }
                }
                this.state = 71;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 72;
            this.match(MinijinjaParser.EOF);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public expr_tag(): Expr_tagContext {
        let localContext = new Expr_tagContext(this.context, this.state);
        this.enterRule(localContext, 2, MinijinjaParser.RULE_expr_tag);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 74;
            this.match(MinijinjaParser.EXPR_OPEN);
            this.state = 76;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (((((_la - 10)) & ~0x1F) === 0 && ((1 << (_la - 10)) & 4294959423) !== 0) || ((((_la - 42)) & ~0x1F) === 0 && ((1 << (_la - 42)) & 352371711) !== 0)) {
                {
                this.state = 75;
                this.expr();
                }
            }

            this.state = 78;
            this.match(MinijinjaParser.EXPR_CLOSE);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public stmt_tag(): Stmt_tagContext {
        let localContext = new Stmt_tagContext(this.context, this.state);
        this.enterRule(localContext, 4, MinijinjaParser.RULE_stmt_tag);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 80;
            this.match(MinijinjaParser.STMT_OPEN);
            this.state = 81;
            this.stmt();
            this.state = 82;
            this.match(MinijinjaParser.STMT_CLOSE);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public comment_tag(): Comment_tagContext {
        let localContext = new Comment_tagContext(this.context, this.state);
        this.enterRule(localContext, 6, MinijinjaParser.RULE_comment_tag);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 84;
            this.match(MinijinjaParser.COMMENT_OPEN);
            this.state = 86;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 79) {
                {
                this.state = 85;
                this.match(MinijinjaParser.COMMENT_TEXT);
                }
            }

            this.state = 88;
            this.match(MinijinjaParser.COMMENT_CLOSE);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public raw_tag(): Raw_tagContext {
        let localContext = new Raw_tagContext(this.context, this.state);
        this.enterRule(localContext, 8, MinijinjaParser.RULE_raw_tag);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 90;
            this.match(MinijinjaParser.RAW_TAG);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public endraw_tag(): Endraw_tagContext {
        let localContext = new Endraw_tagContext(this.context, this.state);
        this.enterRule(localContext, 10, MinijinjaParser.RULE_endraw_tag);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 92;
            this.match(MinijinjaParser.ENDRAW_TAG);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public stmt(): StmtContext {
        let localContext = new StmtContext(this.context, this.state);
        this.enterRule(localContext, 12, MinijinjaParser.RULE_stmt);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 96;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 4, this.context) ) {
            case 1:
                {
                this.state = 94;
                this.keyword();
                }
                break;
            case 2:
                {
                this.state = 95;
                this.id();
                }
                break;
            }
            this.state = 102;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4294967038) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 4294967295) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 1048575) !== 0)) {
                {
                this.state = 100;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 5, this.context) ) {
                case 1:
                    {
                    this.state = 98;
                    this.expr();
                    }
                    break;
                case 2:
                    {
                    this.state = 99;
                    _la = this.tokenStream.LA(1);
                    if(_la<=0 || _la === 8) {
                    this.errorHandler.recoverInline(this);
                    }
                    else {
                        this.errorHandler.reportMatch(this);
                        this.consume();
                    }
                    }
                    break;
                }
                }
                this.state = 104;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public keyword(): KeywordContext {
        let localContext = new KeywordContext(this.context, this.state);
        this.enterRule(localContext, 14, MinijinjaParser.RULE_keyword);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 105;
            _la = this.tokenStream.LA(1);
            if(!(((((_la - 21)) & ~0x1F) === 0 && ((1 << (_la - 21)) & 536870911) !== 0))) {
            this.errorHandler.recoverInline(this);
            }
            else {
                this.errorHandler.reportMatch(this);
                this.consume();
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public expr(): ExprContext {
        let localContext = new ExprContext(this.context, this.state);
        this.enterRule(localContext, 16, MinijinjaParser.RULE_expr);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 107;
            this.cond();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public cond(): CondContext {
        let localContext = new CondContext(this.context, this.state);
        this.enterRule(localContext, 18, MinijinjaParser.RULE_cond);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 109;
            this.or_expr();
            this.state = 116;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 8, this.context) ) {
            case 1:
                {
                this.state = 110;
                this.match(MinijinjaParser.IF);
                this.state = 111;
                this.or_expr();
                this.state = 114;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 7, this.context) ) {
                case 1:
                    {
                    this.state = 112;
                    this.match(MinijinjaParser.ELSE);
                    this.state = 113;
                    this.or_expr();
                    }
                    break;
                }
                }
                break;
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public or_expr(): Or_exprContext {
        let localContext = new Or_exprContext(this.context, this.state);
        this.enterRule(localContext, 20, MinijinjaParser.RULE_or_expr);
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 118;
            this.and_expr();
            this.state = 123;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 9, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 119;
                    this.match(MinijinjaParser.OR);
                    this.state = 120;
                    this.and_expr();
                    }
                    }
                }
                this.state = 125;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 9, this.context);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public and_expr(): And_exprContext {
        let localContext = new And_exprContext(this.context, this.state);
        this.enterRule(localContext, 22, MinijinjaParser.RULE_and_expr);
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 126;
            this.not_expr();
            this.state = 131;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 10, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 127;
                    this.match(MinijinjaParser.AND);
                    this.state = 128;
                    this.not_expr();
                    }
                    }
                }
                this.state = 133;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 10, this.context);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public not_expr(): Not_exprContext {
        let localContext = new Not_exprContext(this.context, this.state);
        this.enterRule(localContext, 24, MinijinjaParser.RULE_not_expr);
        try {
            this.state = 137;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case MinijinjaParser.NOT:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 134;
                this.match(MinijinjaParser.NOT);
                this.state = 135;
                this.not_expr();
                }
                break;
            case MinijinjaParser.STRING:
            case MinijinjaParser.FLOAT:
            case MinijinjaParser.INT:
            case MinijinjaParser.TRUE:
            case MinijinjaParser.FALSE:
            case MinijinjaParser.NONE:
            case MinijinjaParser.ELIF:
            case MinijinjaParser.ENDIF:
            case MinijinjaParser.FOR:
            case MinijinjaParser.ENDFOR:
            case MinijinjaParser.SET:
            case MinijinjaParser.ENDSET:
            case MinijinjaParser.MACRO:
            case MinijinjaParser.ENDMACRO:
            case MinijinjaParser.CALL:
            case MinijinjaParser.ENDCALL:
            case MinijinjaParser.FILTER:
            case MinijinjaParser.ENDFILTER:
            case MinijinjaParser.BLOCK:
            case MinijinjaParser.ENDBLOCK:
            case MinijinjaParser.EXTENDS:
            case MinijinjaParser.INCLUDE:
            case MinijinjaParser.IMPORT:
            case MinijinjaParser.FROM:
            case MinijinjaParser.WITH:
            case MinijinjaParser.ENDWITH:
            case MinijinjaParser.AUTOESCAPE:
            case MinijinjaParser.ENDAUTOESCAPE:
            case MinijinjaParser.RAW:
            case MinijinjaParser.ENDRAW:
            case MinijinjaParser.DO:
            case MinijinjaParser.BREAK:
            case MinijinjaParser.CONTINUE:
            case MinijinjaParser.AS:
            case MinijinjaParser.ID:
            case MinijinjaParser.PLUS:
            case MinijinjaParser.MINUS:
            case MinijinjaParser.LPAREN:
            case MinijinjaParser.LBRACK:
            case MinijinjaParser.LBRACE:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 136;
                this.comparison();
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public comparison(): ComparisonContext {
        let localContext = new ComparisonContext(this.context, this.state);
        this.enterRule(localContext, 26, MinijinjaParser.RULE_comparison);
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 139;
            this.concat();
            this.state = 145;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 12, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 140;
                    this.comp_op();
                    this.state = 141;
                    this.concat();
                    }
                    }
                }
                this.state = 147;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 12, this.context);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public comp_op(): Comp_opContext {
        let localContext = new Comp_opContext(this.context, this.state);
        this.enterRule(localContext, 28, MinijinjaParser.RULE_comp_op);
        let _la: number;
        try {
            this.state = 161;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case MinijinjaParser.EQ:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 148;
                this.match(MinijinjaParser.EQ);
                }
                break;
            case MinijinjaParser.NE:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 149;
                this.match(MinijinjaParser.NE);
                }
                break;
            case MinijinjaParser.LT:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 150;
                this.match(MinijinjaParser.LT);
                }
                break;
            case MinijinjaParser.LE:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 151;
                this.match(MinijinjaParser.LE);
                }
                break;
            case MinijinjaParser.GT:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 152;
                this.match(MinijinjaParser.GT);
                }
                break;
            case MinijinjaParser.GE:
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 153;
                this.match(MinijinjaParser.GE);
                }
                break;
            case MinijinjaParser.IN:
                this.enterOuterAlt(localContext, 7);
                {
                this.state = 154;
                this.match(MinijinjaParser.IN);
                }
                break;
            case MinijinjaParser.NOT:
                this.enterOuterAlt(localContext, 8);
                {
                this.state = 155;
                this.match(MinijinjaParser.NOT);
                this.state = 156;
                this.match(MinijinjaParser.IN);
                }
                break;
            case MinijinjaParser.IS:
                this.enterOuterAlt(localContext, 9);
                {
                this.state = 157;
                this.match(MinijinjaParser.IS);
                this.state = 159;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 18) {
                    {
                    this.state = 158;
                    this.match(MinijinjaParser.NOT);
                    }
                }

                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public concat(): ConcatContext {
        let localContext = new ConcatContext(this.context, this.state);
        this.enterRule(localContext, 30, MinijinjaParser.RULE_concat);
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 163;
            this.additive();
            this.state = 168;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 15, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 164;
                    this.match(MinijinjaParser.TILDE);
                    this.state = 165;
                    this.additive();
                    }
                    }
                }
                this.state = 170;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 15, this.context);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public additive(): AdditiveContext {
        let localContext = new AdditiveContext(this.context, this.state);
        this.enterRule(localContext, 32, MinijinjaParser.RULE_additive);
        let _la: number;
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 171;
            this.term();
            this.state = 176;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 16, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 172;
                    _la = this.tokenStream.LA(1);
                    if(!(_la === 56 || _la === 57)) {
                    this.errorHandler.recoverInline(this);
                    }
                    else {
                        this.errorHandler.reportMatch(this);
                        this.consume();
                    }
                    this.state = 173;
                    this.term();
                    }
                    }
                }
                this.state = 178;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 16, this.context);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public term(): TermContext {
        let localContext = new TermContext(this.context, this.state);
        this.enterRule(localContext, 34, MinijinjaParser.RULE_term);
        let _la: number;
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 179;
            this.factor();
            this.state = 184;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 17, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 180;
                    _la = this.tokenStream.LA(1);
                    if(!(((((_la - 53)) & ~0x1F) === 0 && ((1 << (_la - 53)) & 39) !== 0))) {
                    this.errorHandler.recoverInline(this);
                    }
                    else {
                        this.errorHandler.reportMatch(this);
                        this.consume();
                    }
                    this.state = 181;
                    this.factor();
                    }
                    }
                }
                this.state = 186;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 17, this.context);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public factor(): FactorContext {
        let localContext = new FactorContext(this.context, this.state);
        this.enterRule(localContext, 36, MinijinjaParser.RULE_factor);
        let _la: number;
        try {
            this.state = 190;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case MinijinjaParser.PLUS:
            case MinijinjaParser.MINUS:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 187;
                _la = this.tokenStream.LA(1);
                if(!(_la === 56 || _la === 57)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 188;
                this.factor();
                }
                break;
            case MinijinjaParser.STRING:
            case MinijinjaParser.FLOAT:
            case MinijinjaParser.INT:
            case MinijinjaParser.TRUE:
            case MinijinjaParser.FALSE:
            case MinijinjaParser.NONE:
            case MinijinjaParser.ELIF:
            case MinijinjaParser.ENDIF:
            case MinijinjaParser.FOR:
            case MinijinjaParser.ENDFOR:
            case MinijinjaParser.SET:
            case MinijinjaParser.ENDSET:
            case MinijinjaParser.MACRO:
            case MinijinjaParser.ENDMACRO:
            case MinijinjaParser.CALL:
            case MinijinjaParser.ENDCALL:
            case MinijinjaParser.FILTER:
            case MinijinjaParser.ENDFILTER:
            case MinijinjaParser.BLOCK:
            case MinijinjaParser.ENDBLOCK:
            case MinijinjaParser.EXTENDS:
            case MinijinjaParser.INCLUDE:
            case MinijinjaParser.IMPORT:
            case MinijinjaParser.FROM:
            case MinijinjaParser.WITH:
            case MinijinjaParser.ENDWITH:
            case MinijinjaParser.AUTOESCAPE:
            case MinijinjaParser.ENDAUTOESCAPE:
            case MinijinjaParser.RAW:
            case MinijinjaParser.ENDRAW:
            case MinijinjaParser.DO:
            case MinijinjaParser.BREAK:
            case MinijinjaParser.CONTINUE:
            case MinijinjaParser.AS:
            case MinijinjaParser.ID:
            case MinijinjaParser.LPAREN:
            case MinijinjaParser.LBRACK:
            case MinijinjaParser.LBRACE:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 189;
                this.power();
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public power(): PowerContext {
        let localContext = new PowerContext(this.context, this.state);
        this.enterRule(localContext, 38, MinijinjaParser.RULE_power);
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 192;
            this.filtered();
            this.state = 197;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 19, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 193;
                    this.match(MinijinjaParser.POW);
                    this.state = 194;
                    this.factor();
                    }
                    }
                }
                this.state = 199;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 19, this.context);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public filtered(): FilteredContext {
        let localContext = new FilteredContext(this.context, this.state);
        this.enterRule(localContext, 40, MinijinjaParser.RULE_filtered);
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 200;
            this.primary(0);
            this.state = 205;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 20, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 201;
                    this.match(MinijinjaParser.PIPE);
                    this.state = 202;
                    this.filter();
                    }
                    }
                }
                this.state = 207;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 20, this.context);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public filter(): FilterContext {
        let localContext = new FilterContext(this.context, this.state);
        this.enterRule(localContext, 42, MinijinjaParser.RULE_filter);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 208;
            this.id();
            this.state = 214;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 22, this.context) ) {
            case 1:
                {
                this.state = 209;
                this.match(MinijinjaParser.LPAREN);
                this.state = 211;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (((((_la - 10)) & ~0x1F) === 0 && ((1 << (_la - 10)) & 4294959423) !== 0) || ((((_la - 42)) & ~0x1F) === 0 && ((1 << (_la - 42)) & 352371711) !== 0)) {
                    {
                    this.state = 210;
                    this.arg_list();
                    }
                }

                this.state = 213;
                this.match(MinijinjaParser.RPAREN);
                }
                break;
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }

    public primary(): PrimaryContext;
    public primary(_p: number): PrimaryContext;
    public primary(_p?: number): PrimaryContext {
        if (_p === undefined) {
            _p = 0;
        }

        let parentContext = this.context;
        let parentState = this.state;
        let localContext = new PrimaryContext(this.context, parentState);
        let previousContext = localContext;
        let _startState = 44;
        this.enterRecursionRule(localContext, 44, MinijinjaParser.RULE_primary, _p);
        let _la: number;
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 263;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case MinijinjaParser.LPAREN:
                {
                localContext = new GroupExprContext(localContext);
                this.context = localContext;
                previousContext = localContext;

                this.state = 217;
                this.match(MinijinjaParser.LPAREN);
                this.state = 218;
                this.expr();
                this.state = 223;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 23, this.context);
                while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                    if (alternative === 1) {
                        {
                        {
                        this.state = 219;
                        this.match(MinijinjaParser.COMMA);
                        this.state = 220;
                        this.expr();
                        }
                        }
                    }
                    this.state = 225;
                    this.errorHandler.sync(this);
                    alternative = this.interpreter.adaptivePredict(this.tokenStream, 23, this.context);
                }
                this.state = 227;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 72) {
                    {
                    this.state = 226;
                    this.match(MinijinjaParser.COMMA);
                    }
                }

                this.state = 229;
                this.match(MinijinjaParser.RPAREN);
                }
                break;
            case MinijinjaParser.LBRACK:
                {
                localContext = new ListExprContext(localContext);
                this.context = localContext;
                previousContext = localContext;
                this.state = 231;
                this.match(MinijinjaParser.LBRACK);
                this.state = 243;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (((((_la - 10)) & ~0x1F) === 0 && ((1 << (_la - 10)) & 4294959423) !== 0) || ((((_la - 42)) & ~0x1F) === 0 && ((1 << (_la - 42)) & 352371711) !== 0)) {
                    {
                    this.state = 232;
                    this.expr();
                    this.state = 237;
                    this.errorHandler.sync(this);
                    alternative = this.interpreter.adaptivePredict(this.tokenStream, 25, this.context);
                    while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                        if (alternative === 1) {
                            {
                            {
                            this.state = 233;
                            this.match(MinijinjaParser.COMMA);
                            this.state = 234;
                            this.expr();
                            }
                            }
                        }
                        this.state = 239;
                        this.errorHandler.sync(this);
                        alternative = this.interpreter.adaptivePredict(this.tokenStream, 25, this.context);
                    }
                    this.state = 241;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                    if (_la === 72) {
                        {
                        this.state = 240;
                        this.match(MinijinjaParser.COMMA);
                        }
                    }

                    }
                }

                this.state = 245;
                this.match(MinijinjaParser.RBRACK);
                }
                break;
            case MinijinjaParser.LBRACE:
                {
                localContext = new DictExprContext(localContext);
                this.context = localContext;
                previousContext = localContext;
                this.state = 246;
                this.match(MinijinjaParser.LBRACE);
                this.state = 258;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (((((_la - 10)) & ~0x1F) === 0 && ((1 << (_la - 10)) & 4294959423) !== 0) || ((((_la - 42)) & ~0x1F) === 0 && ((1 << (_la - 42)) & 352371711) !== 0)) {
                    {
                    this.state = 247;
                    this.dict_entry();
                    this.state = 252;
                    this.errorHandler.sync(this);
                    alternative = this.interpreter.adaptivePredict(this.tokenStream, 28, this.context);
                    while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                        if (alternative === 1) {
                            {
                            {
                            this.state = 248;
                            this.match(MinijinjaParser.COMMA);
                            this.state = 249;
                            this.dict_entry();
                            }
                            }
                        }
                        this.state = 254;
                        this.errorHandler.sync(this);
                        alternative = this.interpreter.adaptivePredict(this.tokenStream, 28, this.context);
                    }
                    this.state = 256;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                    if (_la === 72) {
                        {
                        this.state = 255;
                        this.match(MinijinjaParser.COMMA);
                        }
                    }

                    }
                }

                this.state = 260;
                this.match(MinijinjaParser.RBRACE);
                }
                break;
            case MinijinjaParser.STRING:
            case MinijinjaParser.FLOAT:
            case MinijinjaParser.INT:
            case MinijinjaParser.TRUE:
            case MinijinjaParser.FALSE:
            case MinijinjaParser.NONE:
                {
                localContext = new LiteralExprContext(localContext);
                this.context = localContext;
                previousContext = localContext;
                this.state = 261;
                this.literal();
                }
                break;
            case MinijinjaParser.ELIF:
            case MinijinjaParser.ENDIF:
            case MinijinjaParser.FOR:
            case MinijinjaParser.ENDFOR:
            case MinijinjaParser.SET:
            case MinijinjaParser.ENDSET:
            case MinijinjaParser.MACRO:
            case MinijinjaParser.ENDMACRO:
            case MinijinjaParser.CALL:
            case MinijinjaParser.ENDCALL:
            case MinijinjaParser.FILTER:
            case MinijinjaParser.ENDFILTER:
            case MinijinjaParser.BLOCK:
            case MinijinjaParser.ENDBLOCK:
            case MinijinjaParser.EXTENDS:
            case MinijinjaParser.INCLUDE:
            case MinijinjaParser.IMPORT:
            case MinijinjaParser.FROM:
            case MinijinjaParser.WITH:
            case MinijinjaParser.ENDWITH:
            case MinijinjaParser.AUTOESCAPE:
            case MinijinjaParser.ENDAUTOESCAPE:
            case MinijinjaParser.RAW:
            case MinijinjaParser.ENDRAW:
            case MinijinjaParser.DO:
            case MinijinjaParser.BREAK:
            case MinijinjaParser.CONTINUE:
            case MinijinjaParser.AS:
            case MinijinjaParser.ID:
                {
                localContext = new NameExprContext(localContext);
                this.context = localContext;
                previousContext = localContext;
                this.state = 262;
                this.id();
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
            this.context!.stop = this.tokenStream.LT(-1);
            this.state = 281;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 34, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    if (this.parseListeners != null) {
                        this.triggerExitRuleEvent();
                    }
                    previousContext = localContext;
                    {
                    this.state = 279;
                    this.errorHandler.sync(this);
                    switch (this.interpreter.adaptivePredict(this.tokenStream, 33, this.context) ) {
                    case 1:
                        {
                        localContext = new CallExprContext(new PrimaryContext(parentContext, parentState));
                        this.pushNewRecursionContext(localContext, _startState, MinijinjaParser.RULE_primary);
                        this.state = 265;
                        if (!(this.precpred(this.context, 8))) {
                            throw this.createFailedPredicateException("this.precpred(this.context, 8)");
                        }
                        this.state = 266;
                        this.match(MinijinjaParser.LPAREN);
                        this.state = 268;
                        this.errorHandler.sync(this);
                        _la = this.tokenStream.LA(1);
                        if (((((_la - 10)) & ~0x1F) === 0 && ((1 << (_la - 10)) & 4294959423) !== 0) || ((((_la - 42)) & ~0x1F) === 0 && ((1 << (_la - 42)) & 352371711) !== 0)) {
                            {
                            this.state = 267;
                            this.arg_list();
                            }
                        }

                        this.state = 270;
                        this.match(MinijinjaParser.RPAREN);
                        }
                        break;
                    case 2:
                        {
                        localContext = new MemberExprContext(new PrimaryContext(parentContext, parentState));
                        this.pushNewRecursionContext(localContext, _startState, MinijinjaParser.RULE_primary);
                        this.state = 271;
                        if (!(this.precpred(this.context, 7))) {
                            throw this.createFailedPredicateException("this.precpred(this.context, 7)");
                        }
                        this.state = 272;
                        this.match(MinijinjaParser.DOT);
                        this.state = 273;
                        this.id();
                        }
                        break;
                    case 3:
                        {
                        localContext = new IndexExprContext(new PrimaryContext(parentContext, parentState));
                        this.pushNewRecursionContext(localContext, _startState, MinijinjaParser.RULE_primary);
                        this.state = 274;
                        if (!(this.precpred(this.context, 6))) {
                            throw this.createFailedPredicateException("this.precpred(this.context, 6)");
                        }
                        this.state = 275;
                        this.match(MinijinjaParser.LBRACK);
                        this.state = 276;
                        this.subscript();
                        this.state = 277;
                        this.match(MinijinjaParser.RBRACK);
                        }
                        break;
                    }
                    }
                }
                this.state = 283;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 34, this.context);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.unrollRecursionContexts(parentContext);
        }
        return localContext;
    }
    public arg_list(): Arg_listContext {
        let localContext = new Arg_listContext(this.context, this.state);
        this.enterRule(localContext, 46, MinijinjaParser.RULE_arg_list);
        let _la: number;
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 284;
            this.arg();
            this.state = 289;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 35, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 285;
                    this.match(MinijinjaParser.COMMA);
                    this.state = 286;
                    this.arg();
                    }
                    }
                }
                this.state = 291;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 35, this.context);
            }
            this.state = 293;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 72) {
                {
                this.state = 292;
                this.match(MinijinjaParser.COMMA);
                }
            }

            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public arg(): ArgContext {
        let localContext = new ArgContext(this.context, this.state);
        this.enterRule(localContext, 48, MinijinjaParser.RULE_arg);
        try {
            this.state = 300;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 37, this.context) ) {
            case 1:
                localContext = new KwargContext(localContext);
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 295;
                this.id();
                this.state = 296;
                this.match(MinijinjaParser.ASSIGN);
                this.state = 297;
                this.expr();
                }
                break;
            case 2:
                localContext = new PosargContext(localContext);
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 299;
                this.expr();
                }
                break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public subscript(): SubscriptContext {
        let localContext = new SubscriptContext(this.context, this.state);
        this.enterRule(localContext, 50, MinijinjaParser.RULE_subscript);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 302;
            this.slice_bound();
            this.state = 309;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 73) {
                {
                this.state = 303;
                this.match(MinijinjaParser.COLON);
                this.state = 304;
                this.slice_bound();
                this.state = 307;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 73) {
                    {
                    this.state = 305;
                    this.match(MinijinjaParser.COLON);
                    this.state = 306;
                    this.slice_bound();
                    }
                }

                }
            }

            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public slice_bound(): Slice_boundContext {
        let localContext = new Slice_boundContext(this.context, this.state);
        this.enterRule(localContext, 52, MinijinjaParser.RULE_slice_bound);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 312;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (((((_la - 10)) & ~0x1F) === 0 && ((1 << (_la - 10)) & 4294959423) !== 0) || ((((_la - 42)) & ~0x1F) === 0 && ((1 << (_la - 42)) & 352371711) !== 0)) {
                {
                this.state = 311;
                this.expr();
                }
            }

            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public dict_entry(): Dict_entryContext {
        let localContext = new Dict_entryContext(this.context, this.state);
        this.enterRule(localContext, 54, MinijinjaParser.RULE_dict_entry);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 314;
            this.expr();
            this.state = 315;
            this.match(MinijinjaParser.COLON);
            this.state = 316;
            this.expr();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public literal(): LiteralContext {
        let localContext = new LiteralContext(this.context, this.state);
        this.enterRule(localContext, 56, MinijinjaParser.RULE_literal);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 318;
            _la = this.tokenStream.LA(1);
            if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 64512) !== 0))) {
            this.errorHandler.recoverInline(this);
            }
            else {
                this.errorHandler.reportMatch(this);
                this.consume();
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public id(): IdContext {
        let localContext = new IdContext(this.context, this.state);
        this.enterRule(localContext, 58, MinijinjaParser.RULE_id);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 320;
            _la = this.tokenStream.LA(1);
            if(!(((((_la - 23)) & ~0x1F) === 0 && ((1 << (_la - 23)) & 536870911) !== 0))) {
            this.errorHandler.recoverInline(this);
            }
            else {
                this.errorHandler.reportMatch(this);
                this.consume();
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }

    public override sempred(localContext: antlr.ParserRuleContext | null, ruleIndex: number, predIndex: number): boolean {
        switch (ruleIndex) {
        case 22:
            return this.primary_sempred(localContext as PrimaryContext, predIndex);
        }
        return true;
    }
    private primary_sempred(localContext: PrimaryContext | null, predIndex: number): boolean {
        switch (predIndex) {
        case 0:
            return this.precpred(this.context, 8);
        case 1:
            return this.precpred(this.context, 7);
        case 2:
            return this.precpred(this.context, 6);
        }
        return true;
    }

    public static readonly _serializedATN: number[] = [
        4,1,83,323,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,4,2,5,7,5,2,6,7,
        6,2,7,7,7,2,8,7,8,2,9,7,9,2,10,7,10,2,11,7,11,2,12,7,12,2,13,7,13,
        2,14,7,14,2,15,7,15,2,16,7,16,2,17,7,17,2,18,7,18,2,19,7,19,2,20,
        7,20,2,21,7,21,2,22,7,22,2,23,7,23,2,24,7,24,2,25,7,25,2,26,7,26,
        2,27,7,27,2,28,7,28,2,29,7,29,1,0,1,0,1,0,1,0,1,0,1,0,1,0,5,0,68,
        8,0,10,0,12,0,71,9,0,1,0,1,0,1,1,1,1,3,1,77,8,1,1,1,1,1,1,2,1,2,
        1,2,1,2,1,3,1,3,3,3,87,8,3,1,3,1,3,1,4,1,4,1,5,1,5,1,6,1,6,3,6,97,
        8,6,1,6,1,6,5,6,101,8,6,10,6,12,6,104,9,6,1,7,1,7,1,8,1,8,1,9,1,
        9,1,9,1,9,1,9,3,9,115,8,9,3,9,117,8,9,1,10,1,10,1,10,5,10,122,8,
        10,10,10,12,10,125,9,10,1,11,1,11,1,11,5,11,130,8,11,10,11,12,11,
        133,9,11,1,12,1,12,1,12,3,12,138,8,12,1,13,1,13,1,13,1,13,5,13,144,
        8,13,10,13,12,13,147,9,13,1,14,1,14,1,14,1,14,1,14,1,14,1,14,1,14,
        1,14,1,14,1,14,3,14,160,8,14,3,14,162,8,14,1,15,1,15,1,15,5,15,167,
        8,15,10,15,12,15,170,9,15,1,16,1,16,1,16,5,16,175,8,16,10,16,12,
        16,178,9,16,1,17,1,17,1,17,5,17,183,8,17,10,17,12,17,186,9,17,1,
        18,1,18,1,18,3,18,191,8,18,1,19,1,19,1,19,5,19,196,8,19,10,19,12,
        19,199,9,19,1,20,1,20,1,20,5,20,204,8,20,10,20,12,20,207,9,20,1,
        21,1,21,1,21,3,21,212,8,21,1,21,3,21,215,8,21,1,22,1,22,1,22,1,22,
        1,22,5,22,222,8,22,10,22,12,22,225,9,22,1,22,3,22,228,8,22,1,22,
        1,22,1,22,1,22,1,22,1,22,5,22,236,8,22,10,22,12,22,239,9,22,1,22,
        3,22,242,8,22,3,22,244,8,22,1,22,1,22,1,22,1,22,1,22,5,22,251,8,
        22,10,22,12,22,254,9,22,1,22,3,22,257,8,22,3,22,259,8,22,1,22,1,
        22,1,22,3,22,264,8,22,1,22,1,22,1,22,3,22,269,8,22,1,22,1,22,1,22,
        1,22,1,22,1,22,1,22,1,22,1,22,5,22,280,8,22,10,22,12,22,283,9,22,
        1,23,1,23,1,23,5,23,288,8,23,10,23,12,23,291,9,23,1,23,3,23,294,
        8,23,1,24,1,24,1,24,1,24,1,24,3,24,301,8,24,1,25,1,25,1,25,1,25,
        1,25,3,25,308,8,25,3,25,310,8,25,1,26,3,26,313,8,26,1,27,1,27,1,
        27,1,27,1,28,1,28,1,29,1,29,1,29,0,1,44,30,0,2,4,6,8,10,12,14,16,
        18,20,22,24,26,28,30,32,34,36,38,40,42,44,46,48,50,52,54,56,58,0,
        6,1,0,8,8,1,0,21,49,1,0,56,57,2,0,53,55,58,58,1,0,10,15,1,0,23,51,
        350,0,69,1,0,0,0,2,74,1,0,0,0,4,80,1,0,0,0,6,84,1,0,0,0,8,90,1,0,
        0,0,10,92,1,0,0,0,12,96,1,0,0,0,14,105,1,0,0,0,16,107,1,0,0,0,18,
        109,1,0,0,0,20,118,1,0,0,0,22,126,1,0,0,0,24,137,1,0,0,0,26,139,
        1,0,0,0,28,161,1,0,0,0,30,163,1,0,0,0,32,171,1,0,0,0,34,179,1,0,
        0,0,36,190,1,0,0,0,38,192,1,0,0,0,40,200,1,0,0,0,42,208,1,0,0,0,
        44,263,1,0,0,0,46,284,1,0,0,0,48,300,1,0,0,0,50,302,1,0,0,0,52,312,
        1,0,0,0,54,314,1,0,0,0,56,318,1,0,0,0,58,320,1,0,0,0,60,68,3,2,1,
        0,61,68,3,4,2,0,62,68,3,6,3,0,63,68,3,8,4,0,64,68,3,10,5,0,65,68,
        5,5,0,0,66,68,5,6,0,0,67,60,1,0,0,0,67,61,1,0,0,0,67,62,1,0,0,0,
        67,63,1,0,0,0,67,64,1,0,0,0,67,65,1,0,0,0,67,66,1,0,0,0,68,71,1,
        0,0,0,69,67,1,0,0,0,69,70,1,0,0,0,70,72,1,0,0,0,71,69,1,0,0,0,72,
        73,5,0,0,1,73,1,1,0,0,0,74,76,5,2,0,0,75,77,3,16,8,0,76,75,1,0,0,
        0,76,77,1,0,0,0,77,78,1,0,0,0,78,79,5,7,0,0,79,3,1,0,0,0,80,81,5,
        3,0,0,81,82,3,12,6,0,82,83,5,8,0,0,83,5,1,0,0,0,84,86,5,4,0,0,85,
        87,5,79,0,0,86,85,1,0,0,0,86,87,1,0,0,0,87,88,1,0,0,0,88,89,5,78,
        0,0,89,7,1,0,0,0,90,91,5,1,0,0,91,9,1,0,0,0,92,93,5,81,0,0,93,11,
        1,0,0,0,94,97,3,14,7,0,95,97,3,58,29,0,96,94,1,0,0,0,96,95,1,0,0,
        0,96,97,1,0,0,0,97,102,1,0,0,0,98,101,3,16,8,0,99,101,8,0,0,0,100,
        98,1,0,0,0,100,99,1,0,0,0,101,104,1,0,0,0,102,100,1,0,0,0,102,103,
        1,0,0,0,103,13,1,0,0,0,104,102,1,0,0,0,105,106,7,1,0,0,106,15,1,
        0,0,0,107,108,3,18,9,0,108,17,1,0,0,0,109,116,3,20,10,0,110,111,
        5,21,0,0,111,114,3,20,10,0,112,113,5,22,0,0,113,115,3,20,10,0,114,
        112,1,0,0,0,114,115,1,0,0,0,115,117,1,0,0,0,116,110,1,0,0,0,116,
        117,1,0,0,0,117,19,1,0,0,0,118,123,3,22,11,0,119,120,5,17,0,0,120,
        122,3,22,11,0,121,119,1,0,0,0,122,125,1,0,0,0,123,121,1,0,0,0,123,
        124,1,0,0,0,124,21,1,0,0,0,125,123,1,0,0,0,126,131,3,24,12,0,127,
        128,5,16,0,0,128,130,3,24,12,0,129,127,1,0,0,0,130,133,1,0,0,0,131,
        129,1,0,0,0,131,132,1,0,0,0,132,23,1,0,0,0,133,131,1,0,0,0,134,135,
        5,18,0,0,135,138,3,24,12,0,136,138,3,26,13,0,137,134,1,0,0,0,137,
        136,1,0,0,0,138,25,1,0,0,0,139,145,3,30,15,0,140,141,3,28,14,0,141,
        142,3,30,15,0,142,144,1,0,0,0,143,140,1,0,0,0,144,147,1,0,0,0,145,
        143,1,0,0,0,145,146,1,0,0,0,146,27,1,0,0,0,147,145,1,0,0,0,148,162,
        5,59,0,0,149,162,5,60,0,0,150,162,5,63,0,0,151,162,5,61,0,0,152,
        162,5,64,0,0,153,162,5,62,0,0,154,162,5,19,0,0,155,156,5,18,0,0,
        156,162,5,19,0,0,157,159,5,20,0,0,158,160,5,18,0,0,159,158,1,0,0,
        0,159,160,1,0,0,0,160,162,1,0,0,0,161,148,1,0,0,0,161,149,1,0,0,
        0,161,150,1,0,0,0,161,151,1,0,0,0,161,152,1,0,0,0,161,153,1,0,0,
        0,161,154,1,0,0,0,161,155,1,0,0,0,161,157,1,0,0,0,162,29,1,0,0,0,
        163,168,3,32,16,0,164,165,5,76,0,0,165,167,3,32,16,0,166,164,1,0,
        0,0,167,170,1,0,0,0,168,166,1,0,0,0,168,169,1,0,0,0,169,31,1,0,0,
        0,170,168,1,0,0,0,171,176,3,34,17,0,172,173,7,2,0,0,173,175,3,34,
        17,0,174,172,1,0,0,0,175,178,1,0,0,0,176,174,1,0,0,0,176,177,1,0,
        0,0,177,33,1,0,0,0,178,176,1,0,0,0,179,184,3,36,18,0,180,181,7,3,
        0,0,181,183,3,36,18,0,182,180,1,0,0,0,183,186,1,0,0,0,184,182,1,
        0,0,0,184,185,1,0,0,0,185,35,1,0,0,0,186,184,1,0,0,0,187,188,7,2,
        0,0,188,191,3,36,18,0,189,191,3,38,19,0,190,187,1,0,0,0,190,189,
        1,0,0,0,191,37,1,0,0,0,192,197,3,40,20,0,193,194,5,52,0,0,194,196,
        3,36,18,0,195,193,1,0,0,0,196,199,1,0,0,0,197,195,1,0,0,0,197,198,
        1,0,0,0,198,39,1,0,0,0,199,197,1,0,0,0,200,205,3,44,22,0,201,202,
        5,75,0,0,202,204,3,42,21,0,203,201,1,0,0,0,204,207,1,0,0,0,205,203,
        1,0,0,0,205,206,1,0,0,0,206,41,1,0,0,0,207,205,1,0,0,0,208,214,3,
        58,29,0,209,211,5,66,0,0,210,212,3,46,23,0,211,210,1,0,0,0,211,212,
        1,0,0,0,212,213,1,0,0,0,213,215,5,67,0,0,214,209,1,0,0,0,214,215,
        1,0,0,0,215,43,1,0,0,0,216,217,6,22,-1,0,217,218,5,66,0,0,218,223,
        3,16,8,0,219,220,5,72,0,0,220,222,3,16,8,0,221,219,1,0,0,0,222,225,
        1,0,0,0,223,221,1,0,0,0,223,224,1,0,0,0,224,227,1,0,0,0,225,223,
        1,0,0,0,226,228,5,72,0,0,227,226,1,0,0,0,227,228,1,0,0,0,228,229,
        1,0,0,0,229,230,5,67,0,0,230,264,1,0,0,0,231,243,5,68,0,0,232,237,
        3,16,8,0,233,234,5,72,0,0,234,236,3,16,8,0,235,233,1,0,0,0,236,239,
        1,0,0,0,237,235,1,0,0,0,237,238,1,0,0,0,238,241,1,0,0,0,239,237,
        1,0,0,0,240,242,5,72,0,0,241,240,1,0,0,0,241,242,1,0,0,0,242,244,
        1,0,0,0,243,232,1,0,0,0,243,244,1,0,0,0,244,245,1,0,0,0,245,264,
        5,69,0,0,246,258,5,70,0,0,247,252,3,54,27,0,248,249,5,72,0,0,249,
        251,3,54,27,0,250,248,1,0,0,0,251,254,1,0,0,0,252,250,1,0,0,0,252,
        253,1,0,0,0,253,256,1,0,0,0,254,252,1,0,0,0,255,257,5,72,0,0,256,
        255,1,0,0,0,256,257,1,0,0,0,257,259,1,0,0,0,258,247,1,0,0,0,258,
        259,1,0,0,0,259,260,1,0,0,0,260,264,5,71,0,0,261,264,3,56,28,0,262,
        264,3,58,29,0,263,216,1,0,0,0,263,231,1,0,0,0,263,246,1,0,0,0,263,
        261,1,0,0,0,263,262,1,0,0,0,264,281,1,0,0,0,265,266,10,8,0,0,266,
        268,5,66,0,0,267,269,3,46,23,0,268,267,1,0,0,0,268,269,1,0,0,0,269,
        270,1,0,0,0,270,280,5,67,0,0,271,272,10,7,0,0,272,273,5,74,0,0,273,
        280,3,58,29,0,274,275,10,6,0,0,275,276,5,68,0,0,276,277,3,50,25,
        0,277,278,5,69,0,0,278,280,1,0,0,0,279,265,1,0,0,0,279,271,1,0,0,
        0,279,274,1,0,0,0,280,283,1,0,0,0,281,279,1,0,0,0,281,282,1,0,0,
        0,282,45,1,0,0,0,283,281,1,0,0,0,284,289,3,48,24,0,285,286,5,72,
        0,0,286,288,3,48,24,0,287,285,1,0,0,0,288,291,1,0,0,0,289,287,1,
        0,0,0,289,290,1,0,0,0,290,293,1,0,0,0,291,289,1,0,0,0,292,294,5,
        72,0,0,293,292,1,0,0,0,293,294,1,0,0,0,294,47,1,0,0,0,295,296,3,
        58,29,0,296,297,5,65,0,0,297,298,3,16,8,0,298,301,1,0,0,0,299,301,
        3,16,8,0,300,295,1,0,0,0,300,299,1,0,0,0,301,49,1,0,0,0,302,309,
        3,52,26,0,303,304,5,73,0,0,304,307,3,52,26,0,305,306,5,73,0,0,306,
        308,3,52,26,0,307,305,1,0,0,0,307,308,1,0,0,0,308,310,1,0,0,0,309,
        303,1,0,0,0,309,310,1,0,0,0,310,51,1,0,0,0,311,313,3,16,8,0,312,
        311,1,0,0,0,312,313,1,0,0,0,313,53,1,0,0,0,314,315,3,16,8,0,315,
        316,5,73,0,0,316,317,3,16,8,0,317,55,1,0,0,0,318,319,7,4,0,0,319,
        57,1,0,0,0,320,321,7,5,0,0,321,59,1,0,0,0,41,67,69,76,86,96,100,
        102,114,116,123,131,137,145,159,161,168,176,184,190,197,205,211,
        214,223,227,237,241,243,252,256,258,263,268,279,281,289,293,300,
        307,309,312
    ];

    private static __ATN: antlr.ATN;
    public static get _ATN(): antlr.ATN {
        if (!MinijinjaParser.__ATN) {
            MinijinjaParser.__ATN = new antlr.ATNDeserializer().deserialize(MinijinjaParser._serializedATN);
        }

        return MinijinjaParser.__ATN;
    }


    private static readonly vocabulary = new antlr.Vocabulary(MinijinjaParser.literalNames, MinijinjaParser.symbolicNames, []);

    public override get vocabulary(): antlr.Vocabulary {
        return MinijinjaParser.vocabulary;
    }

    private static readonly decisionsToDFA = MinijinjaParser._ATN.decisionToState.map( (ds: antlr.DecisionState, index: number) => new antlr.DFA(ds, index) );
}

export class TagContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public EOF(): antlr.TerminalNode {
        return this.getToken(MinijinjaParser.EOF, 0)!;
    }
    public expr_tag(): Expr_tagContext[];
    public expr_tag(i: number): Expr_tagContext | null;
    public expr_tag(i?: number): Expr_tagContext[] | Expr_tagContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Expr_tagContext);
        }

        return this.getRuleContext(i, Expr_tagContext);
    }
    public stmt_tag(): Stmt_tagContext[];
    public stmt_tag(i: number): Stmt_tagContext | null;
    public stmt_tag(i?: number): Stmt_tagContext[] | Stmt_tagContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Stmt_tagContext);
        }

        return this.getRuleContext(i, Stmt_tagContext);
    }
    public comment_tag(): Comment_tagContext[];
    public comment_tag(i: number): Comment_tagContext | null;
    public comment_tag(i?: number): Comment_tagContext[] | Comment_tagContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Comment_tagContext);
        }

        return this.getRuleContext(i, Comment_tagContext);
    }
    public raw_tag(): Raw_tagContext[];
    public raw_tag(i: number): Raw_tagContext | null;
    public raw_tag(i?: number): Raw_tagContext[] | Raw_tagContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Raw_tagContext);
        }

        return this.getRuleContext(i, Raw_tagContext);
    }
    public endraw_tag(): Endraw_tagContext[];
    public endraw_tag(i: number): Endraw_tagContext | null;
    public endraw_tag(i?: number): Endraw_tagContext[] | Endraw_tagContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Endraw_tagContext);
        }

        return this.getRuleContext(i, Endraw_tagContext);
    }
    public RAW_TEXT(): antlr.TerminalNode[];
    public RAW_TEXT(i: number): antlr.TerminalNode | null;
    public RAW_TEXT(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(MinijinjaParser.RAW_TEXT);
    	} else {
    		return this.getToken(MinijinjaParser.RAW_TEXT, i);
    	}
    }
    public STRAY(): antlr.TerminalNode[];
    public STRAY(i: number): antlr.TerminalNode | null;
    public STRAY(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(MinijinjaParser.STRAY);
    	} else {
    		return this.getToken(MinijinjaParser.STRAY, i);
    	}
    }
    public override get ruleIndex(): number {
        return MinijinjaParser.RULE_tag;
    }
}


export class Expr_tagContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public EXPR_OPEN(): antlr.TerminalNode {
        return this.getToken(MinijinjaParser.EXPR_OPEN, 0)!;
    }
    public EXPR_CLOSE(): antlr.TerminalNode {
        return this.getToken(MinijinjaParser.EXPR_CLOSE, 0)!;
    }
    public expr(): ExprContext | null {
        return this.getRuleContext(0, ExprContext);
    }
    public override get ruleIndex(): number {
        return MinijinjaParser.RULE_expr_tag;
    }
}


export class Stmt_tagContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public STMT_OPEN(): antlr.TerminalNode {
        return this.getToken(MinijinjaParser.STMT_OPEN, 0)!;
    }
    public stmt(): StmtContext {
        return this.getRuleContext(0, StmtContext)!;
    }
    public STMT_CLOSE(): antlr.TerminalNode {
        return this.getToken(MinijinjaParser.STMT_CLOSE, 0)!;
    }
    public override get ruleIndex(): number {
        return MinijinjaParser.RULE_stmt_tag;
    }
}


export class Comment_tagContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public COMMENT_OPEN(): antlr.TerminalNode {
        return this.getToken(MinijinjaParser.COMMENT_OPEN, 0)!;
    }
    public COMMENT_CLOSE(): antlr.TerminalNode {
        return this.getToken(MinijinjaParser.COMMENT_CLOSE, 0)!;
    }
    public COMMENT_TEXT(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.COMMENT_TEXT, 0);
    }
    public override get ruleIndex(): number {
        return MinijinjaParser.RULE_comment_tag;
    }
}


export class Raw_tagContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public RAW_TAG(): antlr.TerminalNode {
        return this.getToken(MinijinjaParser.RAW_TAG, 0)!;
    }
    public override get ruleIndex(): number {
        return MinijinjaParser.RULE_raw_tag;
    }
}


export class Endraw_tagContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public ENDRAW_TAG(): antlr.TerminalNode {
        return this.getToken(MinijinjaParser.ENDRAW_TAG, 0)!;
    }
    public override get ruleIndex(): number {
        return MinijinjaParser.RULE_endraw_tag;
    }
}


export class StmtContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public keyword(): KeywordContext | null {
        return this.getRuleContext(0, KeywordContext);
    }
    public id(): IdContext | null {
        return this.getRuleContext(0, IdContext);
    }
    public expr(): ExprContext[];
    public expr(i: number): ExprContext | null;
    public expr(i?: number): ExprContext[] | ExprContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ExprContext);
        }

        return this.getRuleContext(i, ExprContext);
    }
    public STMT_CLOSE(): antlr.TerminalNode[];
    public STMT_CLOSE(i: number): antlr.TerminalNode | null;
    public STMT_CLOSE(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(MinijinjaParser.STMT_CLOSE);
    	} else {
    		return this.getToken(MinijinjaParser.STMT_CLOSE, i);
    	}
    }
    public override get ruleIndex(): number {
        return MinijinjaParser.RULE_stmt;
    }
}


export class KeywordContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public IF(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.IF, 0);
    }
    public ELIF(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.ELIF, 0);
    }
    public ELSE(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.ELSE, 0);
    }
    public ENDIF(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.ENDIF, 0);
    }
    public FOR(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.FOR, 0);
    }
    public ENDFOR(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.ENDFOR, 0);
    }
    public SET(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.SET, 0);
    }
    public ENDSET(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.ENDSET, 0);
    }
    public MACRO(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.MACRO, 0);
    }
    public ENDMACRO(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.ENDMACRO, 0);
    }
    public CALL(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.CALL, 0);
    }
    public ENDCALL(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.ENDCALL, 0);
    }
    public FILTER(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.FILTER, 0);
    }
    public ENDFILTER(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.ENDFILTER, 0);
    }
    public BLOCK(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.BLOCK, 0);
    }
    public ENDBLOCK(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.ENDBLOCK, 0);
    }
    public EXTENDS(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.EXTENDS, 0);
    }
    public INCLUDE(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.INCLUDE, 0);
    }
    public IMPORT(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.IMPORT, 0);
    }
    public FROM(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.FROM, 0);
    }
    public WITH(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.WITH, 0);
    }
    public ENDWITH(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.ENDWITH, 0);
    }
    public AUTOESCAPE(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.AUTOESCAPE, 0);
    }
    public ENDAUTOESCAPE(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.ENDAUTOESCAPE, 0);
    }
    public RAW(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.RAW, 0);
    }
    public ENDRAW(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.ENDRAW, 0);
    }
    public DO(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.DO, 0);
    }
    public BREAK(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.BREAK, 0);
    }
    public CONTINUE(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.CONTINUE, 0);
    }
    public override get ruleIndex(): number {
        return MinijinjaParser.RULE_keyword;
    }
}


export class ExprContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public cond(): CondContext {
        return this.getRuleContext(0, CondContext)!;
    }
    public override get ruleIndex(): number {
        return MinijinjaParser.RULE_expr;
    }
}


export class CondContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public or_expr(): Or_exprContext[];
    public or_expr(i: number): Or_exprContext | null;
    public or_expr(i?: number): Or_exprContext[] | Or_exprContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Or_exprContext);
        }

        return this.getRuleContext(i, Or_exprContext);
    }
    public IF(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.IF, 0);
    }
    public ELSE(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.ELSE, 0);
    }
    public override get ruleIndex(): number {
        return MinijinjaParser.RULE_cond;
    }
}


export class Or_exprContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public and_expr(): And_exprContext[];
    public and_expr(i: number): And_exprContext | null;
    public and_expr(i?: number): And_exprContext[] | And_exprContext | null {
        if (i === undefined) {
            return this.getRuleContexts(And_exprContext);
        }

        return this.getRuleContext(i, And_exprContext);
    }
    public OR(): antlr.TerminalNode[];
    public OR(i: number): antlr.TerminalNode | null;
    public OR(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(MinijinjaParser.OR);
    	} else {
    		return this.getToken(MinijinjaParser.OR, i);
    	}
    }
    public override get ruleIndex(): number {
        return MinijinjaParser.RULE_or_expr;
    }
}


export class And_exprContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public not_expr(): Not_exprContext[];
    public not_expr(i: number): Not_exprContext | null;
    public not_expr(i?: number): Not_exprContext[] | Not_exprContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Not_exprContext);
        }

        return this.getRuleContext(i, Not_exprContext);
    }
    public AND(): antlr.TerminalNode[];
    public AND(i: number): antlr.TerminalNode | null;
    public AND(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(MinijinjaParser.AND);
    	} else {
    		return this.getToken(MinijinjaParser.AND, i);
    	}
    }
    public override get ruleIndex(): number {
        return MinijinjaParser.RULE_and_expr;
    }
}


export class Not_exprContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public NOT(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.NOT, 0);
    }
    public not_expr(): Not_exprContext | null {
        return this.getRuleContext(0, Not_exprContext);
    }
    public comparison(): ComparisonContext | null {
        return this.getRuleContext(0, ComparisonContext);
    }
    public override get ruleIndex(): number {
        return MinijinjaParser.RULE_not_expr;
    }
}


export class ComparisonContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public concat(): ConcatContext[];
    public concat(i: number): ConcatContext | null;
    public concat(i?: number): ConcatContext[] | ConcatContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ConcatContext);
        }

        return this.getRuleContext(i, ConcatContext);
    }
    public comp_op(): Comp_opContext[];
    public comp_op(i: number): Comp_opContext | null;
    public comp_op(i?: number): Comp_opContext[] | Comp_opContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Comp_opContext);
        }

        return this.getRuleContext(i, Comp_opContext);
    }
    public override get ruleIndex(): number {
        return MinijinjaParser.RULE_comparison;
    }
}


export class Comp_opContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public EQ(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.EQ, 0);
    }
    public NE(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.NE, 0);
    }
    public LT(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.LT, 0);
    }
    public LE(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.LE, 0);
    }
    public GT(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.GT, 0);
    }
    public GE(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.GE, 0);
    }
    public IN(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.IN, 0);
    }
    public NOT(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.NOT, 0);
    }
    public IS(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.IS, 0);
    }
    public override get ruleIndex(): number {
        return MinijinjaParser.RULE_comp_op;
    }
}


export class ConcatContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public additive(): AdditiveContext[];
    public additive(i: number): AdditiveContext | null;
    public additive(i?: number): AdditiveContext[] | AdditiveContext | null {
        if (i === undefined) {
            return this.getRuleContexts(AdditiveContext);
        }

        return this.getRuleContext(i, AdditiveContext);
    }
    public TILDE(): antlr.TerminalNode[];
    public TILDE(i: number): antlr.TerminalNode | null;
    public TILDE(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(MinijinjaParser.TILDE);
    	} else {
    		return this.getToken(MinijinjaParser.TILDE, i);
    	}
    }
    public override get ruleIndex(): number {
        return MinijinjaParser.RULE_concat;
    }
}


export class AdditiveContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public term(): TermContext[];
    public term(i: number): TermContext | null;
    public term(i?: number): TermContext[] | TermContext | null {
        if (i === undefined) {
            return this.getRuleContexts(TermContext);
        }

        return this.getRuleContext(i, TermContext);
    }
    public PLUS(): antlr.TerminalNode[];
    public PLUS(i: number): antlr.TerminalNode | null;
    public PLUS(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(MinijinjaParser.PLUS);
    	} else {
    		return this.getToken(MinijinjaParser.PLUS, i);
    	}
    }
    public MINUS(): antlr.TerminalNode[];
    public MINUS(i: number): antlr.TerminalNode | null;
    public MINUS(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(MinijinjaParser.MINUS);
    	} else {
    		return this.getToken(MinijinjaParser.MINUS, i);
    	}
    }
    public override get ruleIndex(): number {
        return MinijinjaParser.RULE_additive;
    }
}


export class TermContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public factor(): FactorContext[];
    public factor(i: number): FactorContext | null;
    public factor(i?: number): FactorContext[] | FactorContext | null {
        if (i === undefined) {
            return this.getRuleContexts(FactorContext);
        }

        return this.getRuleContext(i, FactorContext);
    }
    public STAR(): antlr.TerminalNode[];
    public STAR(i: number): antlr.TerminalNode | null;
    public STAR(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(MinijinjaParser.STAR);
    	} else {
    		return this.getToken(MinijinjaParser.STAR, i);
    	}
    }
    public SLASH(): antlr.TerminalNode[];
    public SLASH(i: number): antlr.TerminalNode | null;
    public SLASH(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(MinijinjaParser.SLASH);
    	} else {
    		return this.getToken(MinijinjaParser.SLASH, i);
    	}
    }
    public DSLASH(): antlr.TerminalNode[];
    public DSLASH(i: number): antlr.TerminalNode | null;
    public DSLASH(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(MinijinjaParser.DSLASH);
    	} else {
    		return this.getToken(MinijinjaParser.DSLASH, i);
    	}
    }
    public PERCENT(): antlr.TerminalNode[];
    public PERCENT(i: number): antlr.TerminalNode | null;
    public PERCENT(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(MinijinjaParser.PERCENT);
    	} else {
    		return this.getToken(MinijinjaParser.PERCENT, i);
    	}
    }
    public override get ruleIndex(): number {
        return MinijinjaParser.RULE_term;
    }
}


export class FactorContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public factor(): FactorContext | null {
        return this.getRuleContext(0, FactorContext);
    }
    public PLUS(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.PLUS, 0);
    }
    public MINUS(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.MINUS, 0);
    }
    public power(): PowerContext | null {
        return this.getRuleContext(0, PowerContext);
    }
    public override get ruleIndex(): number {
        return MinijinjaParser.RULE_factor;
    }
}


export class PowerContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public filtered(): FilteredContext {
        return this.getRuleContext(0, FilteredContext)!;
    }
    public POW(): antlr.TerminalNode[];
    public POW(i: number): antlr.TerminalNode | null;
    public POW(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(MinijinjaParser.POW);
    	} else {
    		return this.getToken(MinijinjaParser.POW, i);
    	}
    }
    public factor(): FactorContext[];
    public factor(i: number): FactorContext | null;
    public factor(i?: number): FactorContext[] | FactorContext | null {
        if (i === undefined) {
            return this.getRuleContexts(FactorContext);
        }

        return this.getRuleContext(i, FactorContext);
    }
    public override get ruleIndex(): number {
        return MinijinjaParser.RULE_power;
    }
}


export class FilteredContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public primary(): PrimaryContext {
        return this.getRuleContext(0, PrimaryContext)!;
    }
    public PIPE(): antlr.TerminalNode[];
    public PIPE(i: number): antlr.TerminalNode | null;
    public PIPE(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(MinijinjaParser.PIPE);
    	} else {
    		return this.getToken(MinijinjaParser.PIPE, i);
    	}
    }
    public filter(): FilterContext[];
    public filter(i: number): FilterContext | null;
    public filter(i?: number): FilterContext[] | FilterContext | null {
        if (i === undefined) {
            return this.getRuleContexts(FilterContext);
        }

        return this.getRuleContext(i, FilterContext);
    }
    public override get ruleIndex(): number {
        return MinijinjaParser.RULE_filtered;
    }
}


export class FilterContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public id(): IdContext {
        return this.getRuleContext(0, IdContext)!;
    }
    public LPAREN(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.LPAREN, 0);
    }
    public RPAREN(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.RPAREN, 0);
    }
    public arg_list(): Arg_listContext | null {
        return this.getRuleContext(0, Arg_listContext);
    }
    public override get ruleIndex(): number {
        return MinijinjaParser.RULE_filter;
    }
}


export class PrimaryContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public override get ruleIndex(): number {
        return MinijinjaParser.RULE_primary;
    }
    public override copyFrom(ctx: PrimaryContext): void {
        super.copyFrom(ctx);
    }
}
export class GroupExprContext extends PrimaryContext {
    public constructor(ctx: PrimaryContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public LPAREN(): antlr.TerminalNode {
        return this.getToken(MinijinjaParser.LPAREN, 0)!;
    }
    public expr(): ExprContext[];
    public expr(i: number): ExprContext | null;
    public expr(i?: number): ExprContext[] | ExprContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ExprContext);
        }

        return this.getRuleContext(i, ExprContext);
    }
    public RPAREN(): antlr.TerminalNode {
        return this.getToken(MinijinjaParser.RPAREN, 0)!;
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(MinijinjaParser.COMMA);
    	} else {
    		return this.getToken(MinijinjaParser.COMMA, i);
    	}
    }
}
export class ListExprContext extends PrimaryContext {
    public constructor(ctx: PrimaryContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public LBRACK(): antlr.TerminalNode {
        return this.getToken(MinijinjaParser.LBRACK, 0)!;
    }
    public RBRACK(): antlr.TerminalNode {
        return this.getToken(MinijinjaParser.RBRACK, 0)!;
    }
    public expr(): ExprContext[];
    public expr(i: number): ExprContext | null;
    public expr(i?: number): ExprContext[] | ExprContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ExprContext);
        }

        return this.getRuleContext(i, ExprContext);
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(MinijinjaParser.COMMA);
    	} else {
    		return this.getToken(MinijinjaParser.COMMA, i);
    	}
    }
}
export class DictExprContext extends PrimaryContext {
    public constructor(ctx: PrimaryContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public LBRACE(): antlr.TerminalNode {
        return this.getToken(MinijinjaParser.LBRACE, 0)!;
    }
    public RBRACE(): antlr.TerminalNode {
        return this.getToken(MinijinjaParser.RBRACE, 0)!;
    }
    public dict_entry(): Dict_entryContext[];
    public dict_entry(i: number): Dict_entryContext | null;
    public dict_entry(i?: number): Dict_entryContext[] | Dict_entryContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Dict_entryContext);
        }

        return this.getRuleContext(i, Dict_entryContext);
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(MinijinjaParser.COMMA);
    	} else {
    		return this.getToken(MinijinjaParser.COMMA, i);
    	}
    }
}
export class LiteralExprContext extends PrimaryContext {
    public constructor(ctx: PrimaryContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public literal(): LiteralContext {
        return this.getRuleContext(0, LiteralContext)!;
    }
}
export class NameExprContext extends PrimaryContext {
    public constructor(ctx: PrimaryContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public id(): IdContext {
        return this.getRuleContext(0, IdContext)!;
    }
}
export class CallExprContext extends PrimaryContext {
    public constructor(ctx: PrimaryContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public primary(): PrimaryContext {
        return this.getRuleContext(0, PrimaryContext)!;
    }
    public LPAREN(): antlr.TerminalNode {
        return this.getToken(MinijinjaParser.LPAREN, 0)!;
    }
    public RPAREN(): antlr.TerminalNode {
        return this.getToken(MinijinjaParser.RPAREN, 0)!;
    }
    public arg_list(): Arg_listContext | null {
        return this.getRuleContext(0, Arg_listContext);
    }
}
export class MemberExprContext extends PrimaryContext {
    public constructor(ctx: PrimaryContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public primary(): PrimaryContext {
        return this.getRuleContext(0, PrimaryContext)!;
    }
    public DOT(): antlr.TerminalNode {
        return this.getToken(MinijinjaParser.DOT, 0)!;
    }
    public id(): IdContext {
        return this.getRuleContext(0, IdContext)!;
    }
}
export class IndexExprContext extends PrimaryContext {
    public constructor(ctx: PrimaryContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public primary(): PrimaryContext {
        return this.getRuleContext(0, PrimaryContext)!;
    }
    public LBRACK(): antlr.TerminalNode {
        return this.getToken(MinijinjaParser.LBRACK, 0)!;
    }
    public subscript(): SubscriptContext {
        return this.getRuleContext(0, SubscriptContext)!;
    }
    public RBRACK(): antlr.TerminalNode {
        return this.getToken(MinijinjaParser.RBRACK, 0)!;
    }
}


export class Arg_listContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public arg(): ArgContext[];
    public arg(i: number): ArgContext | null;
    public arg(i?: number): ArgContext[] | ArgContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ArgContext);
        }

        return this.getRuleContext(i, ArgContext);
    }
    public COMMA(): antlr.TerminalNode[];
    public COMMA(i: number): antlr.TerminalNode | null;
    public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(MinijinjaParser.COMMA);
    	} else {
    		return this.getToken(MinijinjaParser.COMMA, i);
    	}
    }
    public override get ruleIndex(): number {
        return MinijinjaParser.RULE_arg_list;
    }
}


export class ArgContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public override get ruleIndex(): number {
        return MinijinjaParser.RULE_arg;
    }
    public override copyFrom(ctx: ArgContext): void {
        super.copyFrom(ctx);
    }
}
export class KwargContext extends ArgContext {
    public constructor(ctx: ArgContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public id(): IdContext {
        return this.getRuleContext(0, IdContext)!;
    }
    public ASSIGN(): antlr.TerminalNode {
        return this.getToken(MinijinjaParser.ASSIGN, 0)!;
    }
    public expr(): ExprContext {
        return this.getRuleContext(0, ExprContext)!;
    }
}
export class PosargContext extends ArgContext {
    public constructor(ctx: ArgContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public expr(): ExprContext {
        return this.getRuleContext(0, ExprContext)!;
    }
}


export class SubscriptContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public slice_bound(): Slice_boundContext[];
    public slice_bound(i: number): Slice_boundContext | null;
    public slice_bound(i?: number): Slice_boundContext[] | Slice_boundContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Slice_boundContext);
        }

        return this.getRuleContext(i, Slice_boundContext);
    }
    public COLON(): antlr.TerminalNode[];
    public COLON(i: number): antlr.TerminalNode | null;
    public COLON(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(MinijinjaParser.COLON);
    	} else {
    		return this.getToken(MinijinjaParser.COLON, i);
    	}
    }
    public override get ruleIndex(): number {
        return MinijinjaParser.RULE_subscript;
    }
}


export class Slice_boundContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public expr(): ExprContext | null {
        return this.getRuleContext(0, ExprContext);
    }
    public override get ruleIndex(): number {
        return MinijinjaParser.RULE_slice_bound;
    }
}


export class Dict_entryContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public expr(): ExprContext[];
    public expr(i: number): ExprContext | null;
    public expr(i?: number): ExprContext[] | ExprContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ExprContext);
        }

        return this.getRuleContext(i, ExprContext);
    }
    public COLON(): antlr.TerminalNode {
        return this.getToken(MinijinjaParser.COLON, 0)!;
    }
    public override get ruleIndex(): number {
        return MinijinjaParser.RULE_dict_entry;
    }
}


export class LiteralContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public STRING(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.STRING, 0);
    }
    public INT(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.INT, 0);
    }
    public FLOAT(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.FLOAT, 0);
    }
    public TRUE(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.TRUE, 0);
    }
    public FALSE(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.FALSE, 0);
    }
    public NONE(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.NONE, 0);
    }
    public override get ruleIndex(): number {
        return MinijinjaParser.RULE_literal;
    }
}


export class IdContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public ID(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.ID, 0);
    }
    public ELIF(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.ELIF, 0);
    }
    public ENDIF(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.ENDIF, 0);
    }
    public FOR(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.FOR, 0);
    }
    public ENDFOR(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.ENDFOR, 0);
    }
    public SET(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.SET, 0);
    }
    public ENDSET(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.ENDSET, 0);
    }
    public MACRO(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.MACRO, 0);
    }
    public ENDMACRO(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.ENDMACRO, 0);
    }
    public CALL(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.CALL, 0);
    }
    public ENDCALL(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.ENDCALL, 0);
    }
    public FILTER(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.FILTER, 0);
    }
    public ENDFILTER(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.ENDFILTER, 0);
    }
    public BLOCK(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.BLOCK, 0);
    }
    public ENDBLOCK(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.ENDBLOCK, 0);
    }
    public EXTENDS(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.EXTENDS, 0);
    }
    public INCLUDE(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.INCLUDE, 0);
    }
    public IMPORT(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.IMPORT, 0);
    }
    public FROM(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.FROM, 0);
    }
    public WITH(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.WITH, 0);
    }
    public ENDWITH(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.ENDWITH, 0);
    }
    public AUTOESCAPE(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.AUTOESCAPE, 0);
    }
    public ENDAUTOESCAPE(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.ENDAUTOESCAPE, 0);
    }
    public RAW(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.RAW, 0);
    }
    public ENDRAW(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.ENDRAW, 0);
    }
    public DO(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.DO, 0);
    }
    public BREAK(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.BREAK, 0);
    }
    public CONTINUE(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.CONTINUE, 0);
    }
    public AS(): antlr.TerminalNode | null {
        return this.getToken(MinijinjaParser.AS, 0);
    }
    public override get ruleIndex(): number {
        return MinijinjaParser.RULE_id;
    }
}
