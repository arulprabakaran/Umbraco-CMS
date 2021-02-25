﻿using NPoco;
using Umbraco.Cms.Infrastructure.Persistence.DatabaseAnnotations;
using Umbraco.Cms.Infrastructure.Persistence.Dtos;

namespace Umbraco.Tests.LegacyXmlPublishedCache
{
    [TableName("cmsContentXml")]
    [PrimaryKey("nodeId", AutoIncrement = false)]
    [ExplicitColumns]
    internal class ContentXmlDto
    {
        [Column("nodeId")]
        [PrimaryKeyColumn(AutoIncrement = false)]
        [ForeignKey(typeof(ContentDto), Column = "nodeId")]
        public int NodeId { get; set; }

        [Column("xml")]
        [SpecialDbType(SpecialDbTypes.NTEXT)]
        public string Xml { get; set; }

        [Column("rv")]
        public long Rv { get; set; }
    }
}
